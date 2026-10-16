/**
 * Schemalagd datasynk och larm. Körs av workern; larmlogiken används även
 * av "Synka nu" i appen så att en statusövergång alltid larmas exakt en gång.
 */
import { syncAccount, ownerRunner, syncFxRates, type DbRunner, type PrismaClient, type SyncResult } from "@rp/db";
import { getMailer, type Mailer } from "./mail";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function alertEmail(p: { agency: string; client: string; account: string; platform: string; problem: string; message: string; url: string }) {
  const html = `<!doctype html><html lang="sv"><body style="margin:0;background:#f4f4f2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1b19">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:#b45309;padding:16px 28px;color:#fff;font-size:13px;letter-spacing:.04em;text-transform:uppercase">Koppling behöver åtgärd · ${esc(p.agency)}</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 4px;font-size:14px;color:#6b6a66">${esc(p.client)} · ${esc(p.platform)}</p>
<h1 style="margin:0 0 12px;font-size:20px">${esc(p.account)}: ${esc(p.problem)}</h1>
<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#52514e">${esc(p.message)}</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.5">Dashboards och rapporter som använder källan visar data fram till senaste lyckade synk tills kopplingen fungerar igen.</p>
<a href="${esc(p.url)}" style="display:inline-block;background:#1c1b19;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:600">Öppna Databaser</a>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${p.client} · ${p.platform}\n${p.account}: ${p.problem}\n\n${p.message}\n\nÅtgärda: ${p.url}`;
  return { html, text };
}

/**
 * Efter en synk: skapa larm (och mejla byråns admins) när kontot går från
 * fungerande till trasigt; stäng öppna larm när det fungerar igen.
 */
export async function handleSyncOutcome(db: DbRunner, accountId: string, result: SyncResult, opts: { baseUrl: string; mailer?: Mailer; log?: (m: string) => void }) {
  if (result.ok) {
    await db((tx) => tx.syncAlert.updateMany({ where: { accountId, resolvedAt: null }, data: { resolvedAt: new Date() } }));
    return null;
  }
  const open = await db((tx) => tx.syncAlert.findFirst({ where: { accountId, resolvedAt: null, kind: result.status } }));
  if (open) return null; // Redan larmat för det här felet – inget nytt mejl vid varje omförsök.

  const info = await db((tx) =>
    tx.connectedAccount.findUniqueOrThrow({
      where: { id: accountId },
      select: { workspaceId: true, name: true, platform: true, clientSources: { select: { client: { select: { name: true } } } } },
    }),
  );
  // En källa kan användas av flera kunder; larmet gäller källan och nämner alla.
  const clients = info.clientSources.map((c) => c.client.name).join(", ") || "Ingen kund";
  const alert = await db((tx) =>
    tx.syncAlert.create({ data: { workspaceId: info.workspaceId, accountId, kind: result.status, message: result.error ?? "Okänt fel" } }),
  );
  const { workspace, admins } = await db(async (tx) => ({
    workspace: await tx.workspace.findUniqueOrThrow({ where: { id: info.workspaceId }, select: { name: true } }),
    admins: await tx.membership.findMany({ where: { workspaceId: info.workspaceId, role: "ADMIN" }, select: { user: { select: { email: true } } } }),
  }));
  const to = admins.map((a) => a.user.email);
  if (to.length) {
    const problem = result.status === "AUTH_REQUIRED" ? "behörighet saknas" : "synken misslyckades";
    const mail = alertEmail({
      agency: workspace.name,
      client: clients,
      account: info.name,
      platform: info.platform,
      problem,
      message: result.error ?? "",
      url: `${opts.baseUrl}/databases`,
    });
    try {
      await (opts.mailer ?? getMailer()).send({ to, subject: `Larm: ${info.name} (${problem}) – ${clients}`, ...mail, attachments: [] });
      await db((tx) => tx.syncAlert.update({ where: { id: alert.id }, data: { notifiedAt: new Date() } }));
    } catch (e) {
      opts.log?.(`Kunde inte mejla larm för ${accountId}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return alert;
}

/**
 * Synkar konton vars senaste försök är äldre än intervallet. Konton låses
 * atomiskt (FOR UPDATE SKIP LOCKED) så att flera workers kan köras samtidigt;
 * ett lås äldre än 30 minuter räknas som övergivet. Konton som saknar
 * behörighet hoppas över tills de kopplats om, och konton som ingen kund
 * valt i Databaser synkas inte alls.
 */
export async function runDueSyncs(
  owner: PrismaClient,
  opts: { baseUrl: string; intervalHours?: number; batch?: number; concurrency?: number; now?: Date; log?: (m: string) => void; mailer?: Mailer },
) {
  const now = opts.now ?? new Date();
  const log = opts.log ?? console.log;
  const interval = opts.intervalHours ?? Number(process.env.SYNC_INTERVAL_HOURS ?? 4);
  const due = new Date(now.getTime() - interval * 3600_000);
  const stale = new Date(now.getTime() - 30 * 60_000);
  const claimed = await owner.$queryRaw<{ id: string }[]>`
    UPDATE connected_accounts SET "syncLockedAt" = ${now}
    WHERE id IN (
      SELECT a.id FROM connected_accounts a
      JOIN connections c ON c.id = a."connectionId"
      WHERE a.status <> 'AUTH_REQUIRED' AND c.status = 'ACTIVE'
        AND (a."lastSyncAttemptAt" IS NULL OR a."lastSyncAttemptAt" < ${due})
        AND (a."syncLockedAt" IS NULL OR a."syncLockedAt" < ${stale})
        AND EXISTS (SELECT 1 FROM client_sources cs WHERE cs."accountId" = a.id)
      ORDER BY a."lastSyncAttemptAt" ASC NULLS FIRST
      LIMIT ${opts.batch ?? 20}
      FOR UPDATE OF a SKIP LOCKED
    )
    RETURNING id`;

  const db = ownerRunner(owner);
  const results: { id: string; ok: boolean; rows: number; error?: string }[] = [];
  const queue = [...claimed];
  // Begränsad parallellism: kvoter gäller ofta appen totalt, inte per kund.
  await Promise.all(
    Array.from({ length: Math.min(opts.concurrency ?? 3, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const started = Date.now();
        try {
          const res = await syncAccount(db, next.id);
          await handleSyncOutcome(db, next.id, res, { baseUrl: opts.baseUrl, mailer: opts.mailer, log });
          results.push({ id: next.id, ok: res.ok, rows: res.rowsWritten, error: res.error });
          log(JSON.stringify({ event: "sync", account: next.id, ok: res.ok, rows: res.rowsWritten, ms: Date.now() - started, error: res.error }));
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          results.push({ id: next.id, ok: false, rows: 0, error });
          log(JSON.stringify({ event: "sync", account: next.id, ok: false, error }));
        } finally {
          await owner.connectedAccount.update({ where: { id: next.id }, data: { syncLockedAt: null } });
        }
      }
    }),
  );
  return results;
}

/** Hämtar nya ECB-kurser om senaste kursen är äldre än i går. */
export async function syncFxIfStale(owner: PrismaClient, log: (m: string) => void = console.log) {
  const latest = await owner.fxRate.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  const from = latest ? latest.date.toISOString().slice(0, 10) : "2023-01-01";
  if (latest && Date.now() - latest.date.getTime() < 36 * 3600_000) return 0;
  const n = await syncFxRates(owner, from);
  log(JSON.stringify({ event: "fx", rows: n, from }));
  return n;
}
