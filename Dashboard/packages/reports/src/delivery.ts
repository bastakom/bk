/**
 * Utskick: renderar PDF, skickar e-post och loggar leveransen. Används av
 * "Skicka nu" i appen och av workern för schemalagda utskick.
 */
import { formatRange, nextRun, resolvePreset, todayInTimezone, type RangePreset, langOf } from "@rp/core";
import type { DbRunner, PrismaClient } from "@rp/db";
import { getMailer, reportEmail, workspaceSender, type Mailer } from "./mail";
import { pdfFilename, renderDashboardPdf, type PdfLayout } from "./pdf";

export type { DbRunner } from "@rp/db";
export interface DeliverParams {
  db: DbRunner;
  baseUrl: string;
  secret: string;
  workspaceId: string;
  dashboardId: string;
  scheduleId?: string;
  recipients: string[];
  subject: string;
  message?: string | null;
  rangePreset: string;
  compare: string;
  layout: PdfLayout;
  mailer?: Mailer;
}

export async function deliverReport(p: DeliverParams) {
  const info = await p.db((tx) =>
    tx.dashboard.findUniqueOrThrow({
      where: { id: p.dashboardId },
      select: { id: true, name: true, clientId: true, client: { select: { name: true, slug: true, timezone: true, locale: true } } },
    }),
  );
  const workspace = await p.db((tx) => tx.workspace.findUniqueOrThrow({ where: { id: p.workspaceId }, select: { name: true, brandColor: true, emailFrom: true, emailFromName: true, emailVerifiedAt: true } }));
  const range = resolvePreset(p.rangePreset as Exclude<RangePreset, "custom">, todayInTimezone(info.client.timezone));
  const lang = langOf(info.client.locale);
  const rangeLabel = formatRange(range, lang);

  try {
    const rendered = await renderDashboardPdf({
      baseUrl: p.baseUrl,
      secret: p.secret,
      workspaceId: p.workspaceId,
      dashboardId: p.dashboardId,
      layout: p.layout,
      query: { range: p.rangePreset, compare: p.compare },
    });
    const filename = pdfFilename(info.client.name, info.name, range);
    const { html, text } = reportEmail({
      agency: workspace.name,
      brandColor: workspace.brandColor,
      client: info.client.name,
      dashboard: info.name,
      period: rangeLabel,
      message: p.message,
      url: `${p.baseUrl}/clients/${info.client.slug}/dashboards/${info.id}?range=${p.rangePreset}&compare=${p.compare}`,
      filename,
      lang,
    });
    const sent = await (p.mailer ?? getMailer()).send({ from: workspaceSender(workspace), to: p.recipients, subject: p.subject, html, text, attachments: [{ filename, content: rendered.pdf }] });
    return p.db((tx) =>
      tx.reportDelivery.create({
        data: {
          workspaceId: p.workspaceId,
          clientId: info.clientId,
          dashboardId: p.dashboardId,
          scheduleId: p.scheduleId,
          recipients: p.recipients,
          subject: p.subject,
          status: "SENT",
          provider: sent.provider,
          pdfPath: sent.pdfPath,
          htmlPath: sent.htmlPath,
          pageCount: rendered.pages,
          rangeLabel,
        },
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await p.db((tx) =>
      tx.reportDelivery.create({
        data: {
          workspaceId: p.workspaceId,
          clientId: info.clientId,
          dashboardId: p.dashboardId,
          scheduleId: p.scheduleId,
          recipients: p.recipients,
          subject: p.subject,
          status: "FAILED",
          error: message,
          provider: process.env.RESEND_API_KEY ? "resend" : "outbox",
          rangeLabel,
        },
      }),
    );
    throw err;
  }
}


/**
 * Kör förfallna schemalagda utskick. Varje schema låses atomiskt
 * (FOR UPDATE SKIP LOCKED) så att flera workers aldrig skickar samma rapport.
 * Ett lås äldre än 15 minuter räknas som övergivet (t.ex. kraschad worker).
 */
export async function runDueSchedules(owner: PrismaClient, opts: { baseUrl: string; secret: string; now?: Date; db: DbRunner; log?: (msg: string) => void }) {
  const now = opts.now ?? new Date();
  const log = opts.log ?? console.log;
  const claimed = await owner.$queryRaw<{ id: string }[]>`
    UPDATE report_schedules SET "lockedAt" = ${now}
    WHERE id IN (
      SELECT id FROM report_schedules
      WHERE active AND "nextRunAt" <= ${now}
        AND ("lockedAt" IS NULL OR "lockedAt" < ${new Date(now.getTime() - 15 * 60_000)})
      ORDER BY "nextRunAt" LIMIT 5
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const { id } of claimed) {
    const s = await owner.reportSchedule.findUniqueOrThrow({ where: { id } });
    try {
      await deliverReport({
        db: opts.db,
        baseUrl: opts.baseUrl,
        secret: opts.secret,
        workspaceId: s.workspaceId,
        dashboardId: s.dashboardId,
        scheduleId: s.id,
        recipients: s.recipients,
        subject: s.subject,
        message: s.message,
        rangePreset: s.rangePreset,
        compare: s.compare,
        layout: s.layout === "LONG" ? "long" : "paged",
      });
      results.push({ id, ok: true });
      log(`Skickade schema ${id} till ${s.recipients.join(", ")}`);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      results.push({ id, ok: false, error });
      log(`Schema ${id} misslyckades: ${error}`);
    } finally {
      // Nästa körning räknas från planerad tid så att schemat inte glider.
      const next = nextRun({ frequency: s.frequency, weekday: s.weekday, dayOfMonth: s.dayOfMonth, hour: s.hour, timezone: s.timezone }, now);
      await owner.reportSchedule.update({ where: { id }, data: { lastRunAt: now, nextRunAt: next, lockedAt: null } });
    }
  }
  return results;
}
