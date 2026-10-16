import "server-only";
import { evaluateGoal, daysBetween, metricText, goalWindow, todayInTimezone, widgetConfigSchema, type GoalEvaluation, type GoalPeriod, type KpiResult, type MetricMeta, type WidgetConfig } from "@rp/core";
import { loadFxTable, type TenantTx } from "@rp/db";
import { loadWidgetData, type DataContext } from "./dashboard-data";

export interface GoalProgress {
  id: string;
  label: string;
  metric: string;
  meta: MetricMeta;
  target: number;
  period: GoalPeriod;
  /** Gruppnamn, t.ex. "Demoprodukt SE" (mål i samma grupp visas tillsammans) */
  group: string | null;
  /** Målet är nått (volym: utfall ≥ mål; kvot: på rätt sida om målet) */
  reached: boolean;
  /** Målperioden och hur långt in i den utfallet gäller */
  window: { start: string; end: string; through: string };
  actual: number | null;
  currency: string | null;
  evaluation: GoalEvaluation;
  /** Källor som räknas (namn) */
  sources: string[];
  notices: string[];
}

/**
 * Kundens mål med utfall för målperioden som innehåller rapportens slutdatum
 * (t.ex. hela oktober när rapporten visar 1–14 oktober), räknat fram till slutdatumet.
 */
export async function loadGoalProgress(tx: TenantTx, ctx: DataContext, goalIds?: string[]): Promise<GoalProgress[]> {
  const goals = await tx.clientGoal.findMany({
    where: { clientId: ctx.clientId, ...(goalIds ? { id: { in: goalIds } } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const today = todayInTimezone(ctx.clientTimezone);
  const ref = ctx.range.range.end < today ? ctx.range.range.end : today;
  const out: GoalProgress[] = [];

  for (const g of goals) {
    const period = g.period as GoalPeriod;
    const custom = g.startDate && g.endDate ? { start: g.startDate.toISOString().slice(0, 10), end: g.endDate.toISOString().slice(0, 10) } : undefined;
    const window = goalWindow(period, ref, custom);
    // Kampanjperioden: utfall fram till rapportens slut (eller kampanjens slut om den är över).
    const through = period === "custom" ? (ref < window.start ? window.start : ref > window.end ? window.end : ref) : ref;
    const filters = Array.isArray(g.filters) ? (g.filters as WidgetConfig["filters"]) : [];
    // Källor: målets egna, annars alla kundens källor som har metricen.
    const base = ctx.registry.meta(g.metric);
    const meta = { ...base, ...metricText(g.metric, base, ctx.lang) };
    const accounts = ctx.accounts.filter((a) => (g.accountIds.length ? g.accountIds.includes(a.id) : true));
    const goalCtx: DataContext = {
      ...ctx,
      range: { ...ctx.range, preset: "custom", range: { start: window.start, end: through }, compareRange: null },
      fx: await loadFxTable(tx, window.start, through),
    };
    const data = accounts.length
      ? await loadWidgetData(tx, { type: "kpi", accountIds: accounts.map((a) => a.id), config: widgetConfigSchema.parse({ metrics: [g.metric], showComparison: false, filters }) }, goalCtx)
      : null;
    const item = data?.result?.kind === "kpi" ? (data.result as KpiResult).items[0] : undefined;
    const actual = item?.value ?? null;
    // Räckvidd växer också under perioden: behandlas som volym (prognosen är då en uppskattning).
    const additive = meta.aggregation === "sum" || meta.aggregation === "sum_approx" || meta.aggregation === "period";
    const reached = actual !== null && (meta.higherIsBetter === false ? actual <= g.target : actual >= g.target) && g.metric !== "spend";
    out.push({
      group: g.group,
      reached,
      id: g.id,
      label: g.label ?? meta.label,
      metric: g.metric,
      meta,
      target: g.target,
      period,
      window: { ...window, through },
      actual,
      currency: data?.currency ?? ctx.clientCurrency,
      evaluation: evaluateGoal({
        additive,
        budget: g.metric === "spend",
        higherIsBetter: meta.higherIsBetter ?? null,
        target: g.target,
        actual,
        elapsedDays: daysBetween(window.start, through),
        totalDays: daysBetween(window.start, window.end),
      }),
      sources: accounts.map((a) => a.name),
      notices: data?.notices.filter((n) => !n.startsWith("Jämförelse")) ?? ["Kunden har inga källor för målet."],
    });
  }
  return out;
}
