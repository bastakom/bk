/**
 * Larmregler per kund: nyckeltal över/under en gräns, eller ett mål som ligger efter.
 * Utvärderas med samma dataladdning som dashboards (filter, kundens källfilter, valuta).
 * Körs varje timme via /api/cron/alerts (anropas av workern).
 */
import "server-only";
import { addDays, formatMetric, GOAL_STATUS_LABEL, todayInTimezone, widgetConfigSchema, type KpiResult } from "@rp/core";
import { createOwnerClient, withTenant, type TenantTx } from "@rp/db";
import { getMailer, workspaceSender } from "@rp/reports";
import { z } from "zod";
import { appUrl } from "./app-url";
import { buildDataContext, loadWidgetData } from "./dashboard-data";
import { loadGoalProgress } from "./goals";

export const ALERT_WINDOWS = [
  { id: "yesterday", label: "i går" },
  { id: "last_7", label: "senaste 7 dagarna" },
  { id: "month_to_date", label: "hittills denna månad" },
] as const;
export type AlertWindow = (typeof ALERT_WINDOWS)[number]["id"];

export const alertRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("metric"),
    metric: z.string().min(1),
    op: z.enum(["above", "below"]),
    threshold: z.number().min(0).max(1e12),
    window: z.enum(["yesterday", "last_7", "month_to_date"]),
    accountIds: z.array(z.string()).max(30).default([]),
    recipientIds: z.array(z.string()).max(30).default([]),
    active: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal("goal"),
    goalId: z.string().min(1, "Välj ett mål"),
    recipientIds: z.array(z.string()).max(30).default([]),
    active: z.boolean().default(true),
  }),
]);
export type AlertRuleInput = z.infer<typeof alertRuleSchema>;

/** Hur ofta en regel kontrolleras och minsta tid mellan två mejl för samma regel. */
const CHECK_EVERY_MS = Number(process.env.ALERT_CHECK_MINUTES ?? 60) * 60_000;
const RENOTIFY_MS = 24 * 3600_000;

type Rule = Awaited<ReturnType<TenantTx["alertRule"]["findFirstOrThrow"]>>;

export interface AlertEvaluation {
  triggered: boolean;
  value: number | null;
  /** T.ex. "CPA senaste 7 dagarna: 412 kr (gräns: över 300 kr)" */
  description: string;
}

/** Datumintervall för larmets period, i kundens tidszon (i går = senaste hela dagen). */
export function alertRange(window: AlertWindow, today: string) {
  const yesterday = addDays(today, -1);
  if (window === "yesterday") return { start: yesterday, end: yesterday };
  if (window === "last_7") return { start: addDays(today, -7), end: yesterday };
  return { start: `${today.slice(0, 8)}01`, end: today };
}

export async function evaluateRule(tx: TenantTx, rule: Rule): Promise<AlertEvaluation> {
  const client = await tx.client.findUniqueOrThrow({ where: { id: rule.clientId } });
  const today = todayInTimezone(client.timezone);

  if (rule.kind === "goal") {
    const ctx = await buildDataContext(tx, {
      clientId: client.id,
      clientCurrency: client.currency,
      clientTimezone: client.timezone,
      range: { preset: "custom", range: { start: addDays(today, -1), end: addDays(today, -1) }, compare: "previous_period", compareRange: null },
    });
    const [goal] = await loadGoalProgress(tx, ctx, rule.goalId ? [rule.goalId] : []);
    if (!goal) return { triggered: false, value: null, description: "Målet finns inte längre." };
    const f = (v: number | null) => formatMetric(goal.meta, v, goal.currency ?? undefined);
    const status = goal.evaluation.status;
    return {
      triggered: status === "behind" || status === "over_budget",
      value: goal.actual,
      description: `${goal.label}: ${f(goal.actual)} av ${f(goal.target)} – ${GOAL_STATUS_LABEL[status].toLowerCase()}${goal.evaluation.projection !== null ? ` (prognos ${f(goal.evaluation.projection)})` : ""}`,
    };
  }

  const window = (rule.window ?? "last_7") as AlertWindow;
  const range = alertRange(window, today);
  const ctx = await buildDataContext(tx, {
    clientId: client.id,
    clientCurrency: client.currency,
    clientTimezone: client.timezone,
    range: { preset: "custom", range, compare: "previous_period", compareRange: null },
  });
  const accounts = ctx.accounts.filter((a) => !rule.accountIds.length || rule.accountIds.includes(a.id));
  const meta = ctx.registry.meta(rule.metric!);
  const data = accounts.length
    ? await loadWidgetData(tx, { type: "kpi", accountIds: accounts.map((a) => a.id), config: widgetConfigSchema.parse({ metrics: [rule.metric], showComparison: false }) }, ctx)
    : null;
  const item = data?.result?.kind === "kpi" ? (data.result as KpiResult).items[0] : undefined;
  // Ingen data för en volym (t.ex. spend) betyder 0 – så upptäcks att en kampanj slutat leverera.
  const additive = meta.aggregation === "sum" || meta.aggregation === "sum_approx";
  const value = item?.value ?? (additive && accounts.length ? 0 : null);
  const threshold = rule.threshold ?? 0;
  const triggered = value !== null && (rule.op === "above" ? value > threshold : value < threshold);
  const f = (v: number | null) => formatMetric(meta, v, data?.currency ?? client.currency);
  const label = ALERT_WINDOWS.find((w) => w.id === window)!.label;
  return {
    triggered,
    value,
    description: `${meta.label} ${label}: ${f(value)} (gräns: ${rule.op === "above" ? "över" : "under"} ${f(threshold)})`,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function alertMail(p: { agency: string; client: string; description: string; url: string }) {
  const html = `<!doctype html><html lang="sv"><body style="margin:0;background:#fbf8f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2d42">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:#c93035;padding:16px 28px;color:#fff;font-size:13px;letter-spacing:.04em;text-transform:uppercase">Larm · ${esc(p.agency)}</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 4px;font-size:14px;color:#5e6b7e">${esc(p.client)}</p>
<h1 style="margin:0 0 20px;font-size:20px;line-height:1.35;font-weight:400;color:#25364f">${esc(p.description)}</h1>
<a href="${esc(p.url)}" style="display:inline-block;background:#25364f;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:600">Öppna kunden</a>
<p style="margin:24px 0 0;font-size:12px;color:#5e6b7e">Du får larmet igen tidigast om ett dygn om villkoret fortfarande gäller.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { html, text: `${p.client}\n${p.description}\n\n${p.url}` };
}

/** Mottagarnas e-post: valda användare i byrån, annars byråns administratörer. */
async function recipients(tx: TenantTx, workspaceId: string, ids: string[]) {
  const members = await tx.membership.findMany({ where: { workspaceId, ...(ids.length ? { userId: { in: ids }, role: { not: "CLIENT" } } : { role: "ADMIN" }) }, select: { user: { select: { email: true } } } });
  return members.map((m) => m.user.email);
}

/**
 * Utvärderar regler som inte kontrollerats den senaste timmen. Mejlar när en regel
 * slår till (och igen tidigast efter ett dygn om den fortsätter gälla).
 */
export async function runDueAlerts(now = new Date(), log: (m: string) => void = console.log) {
  const owner = createOwnerClient();
  try {
    const due = await owner.alertRule.findMany({
      where: { active: true, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - CHECK_EVERY_MS) } }] },
      select: { id: true, workspaceId: true },
      take: 200,
    });
    const results: { id: string; triggered: boolean; notified: boolean; error?: string }[] = [];
    for (const { id, workspaceId } of due) {
      try {
        const r = await withTenant(workspaceId, async (tx) => {
          const rule = await tx.alertRule.findUniqueOrThrow({ where: { id } });
          const e = await evaluateRule(tx, rule);
          const shouldNotify = e.triggered && (!rule.firing || !rule.lastNotifiedAt || now.getTime() - rule.lastNotifiedAt.getTime() >= RENOTIFY_MS);
          if (shouldNotify) {
            const [client, workspace] = await Promise.all([tx.client.findUniqueOrThrow({ where: { id: rule.clientId } }), tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } })]);
            const to = await recipients(tx, workspaceId, rule.recipientIds);
            if (to.length) {
              const mail = alertMail({ agency: workspace.name, client: client.name, description: e.description, url: `${appUrl()}/clients/${client.slug}` });
              await getMailer().send({ from: workspaceSender(workspace), to, subject: `Larm: ${client.name} – ${e.description}`, ...mail, attachments: [] });
            }
          }
          await tx.alertRule.update({
            where: { id },
            data: { firing: e.triggered, lastValue: e.value, lastCheckedAt: now, ...(shouldNotify ? { lastNotifiedAt: now } : {}) },
          });
          return { triggered: e.triggered, notified: shouldNotify };
        });
        results.push({ id, ...r });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        log(JSON.stringify({ event: "alert", rule: id, ok: false, error }));
        results.push({ id, triggered: false, notified: false, error });
      }
    }
    return results;
  } finally {
    await owner.$disconnect();
  }
}
