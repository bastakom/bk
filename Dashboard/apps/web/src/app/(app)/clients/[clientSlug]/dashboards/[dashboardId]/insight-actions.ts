"use server";

import { WIDGET_META, type WidgetType } from "@rp/core";
import type { Prisma } from "@rp/db";
import { runAction } from "@/lib/actions";
import { parseBrief } from "@/lib/ai/brief";
import { aiConfigured, buildInsightInput, generateClientSummary, generateInsight, insightSchema, type Insight } from "@/lib/ai/insights";
import { loadGoalProgress } from "@/lib/goals";
import { buildDataContext, dashboardFilters, resolveDashboardRange, type DashboardSettings } from "@/lib/dashboard-data";
import { requireRole, requireWorkspace } from "@/lib/dal";

export interface InsightView {
  id: string;
  createdAt: string;
  createdBy: string | null;
  period: { start: string; end: string };
  compare: { start: string; end: string } | null;
  model: string;
  content: Insight;
}

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

/** Sparade analyser för dashboarden, senaste först. */
export async function loadInsights(dashboardId: string): Promise<{ configured: boolean; insights: InsightView[] }> {
  const ctx = await requireWorkspace();
  const { rows, users } = await ctx.tx(async (tx) => {
    const rows = await tx.aiInsight.findMany({ where: { dashboardId }, orderBy: { createdAt: "desc" }, take: 20 });
    const ids = [...new Set(rows.map((r) => r.createdById).filter((x): x is string => !!x))];
    return { rows, users: ids.length ? await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [] };
  });
  return {
    configured: aiConfigured(),
    insights: rows.flatMap((r) => {
      const content = insightSchema.safeParse(r.content);
      if (!content.success) return [];
      return [
        {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          createdBy: users.find((u) => u.id === r.createdById)?.name ?? null,
          period: { start: day(r.periodStart)!, end: day(r.periodEnd)! },
          compare: r.compareStart && r.compareEnd ? { start: day(r.compareStart)!, end: day(r.compareEnd)! } : null,
          model: r.model,
          content: content.data,
        },
      ];
    }),
  };
}

/** Tar fram en ny analys för dashboardens källor och vald period (internt, visas aldrig för kunden). */
export async function createInsight(dashboardId: string, searchParams: Record<string, string>) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    if (!aiConfigured()) throw new Error("AI-analysen är inte aktiverad: ANTHROPIC_API_KEY saknas i .env.");

    const prepared = await prepareInput(ctx, dashboardId, searchParams);

    let result;
    try {
      result = await generateInsight(prepared.input);
    } catch (e) {
      console.error("AI-analys misslyckades", e);
      const status = (e as { status?: number }).status;
      throw new Error(
        status === 401 ? "AI-nyckeln godkändes inte. Kontrollera ANTHROPIC_API_KEY." : status === 429 || status === 529 ? "AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund." : e instanceof Error ? e.message : "AI-analysen misslyckades.",
      );
    }

    const saved = await ctx.tx((tx) =>
      tx.aiInsight.create({
        data: {
          workspaceId: ctx.workspace.id,
          clientId: prepared.clientId,
          dashboardId,
          periodStart: new Date(prepared.range.range.start),
          periodEnd: new Date(prepared.range.range.end),
          compareStart: prepared.range.compareRange ? new Date(prepared.range.compareRange.start) : null,
          compareEnd: prepared.range.compareRange ? new Date(prepared.range.compareRange.end) : null,
          model: result.model,
          content: result.insight as unknown as Prisma.InputJsonValue,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          createdById: ctx.user.id,
        },
        select: { id: true },
      }),
    );
    return { ok: true as const, data: saved.id, message: "Analysen är klar." };
  });
}

export async function deleteInsight(insightId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.aiInsight.delete({ where: { id: insightId } }));
    return { ok: true as const, message: "Analysen är borttagen." };
  });
}

type Ctx = Awaited<ReturnType<typeof requireRole>>;

/** Underlaget för AI:n: rapportens källor, period, filter, brief och mål. */
async function prepareInput(ctx: Ctx, dashboardId: string, searchParams: Record<string, string>) {
  return ctx.tx(async (tx) => {
    const dashboard = await tx.dashboard.findFirstOrThrow({ where: { id: dashboardId }, include: { client: true, widgets: { include: { sources: true } } } });
    const settings = (dashboard.settings ?? {}) as DashboardSettings;
    const range = resolveDashboardRange(searchParams, settings, dashboard.client.timezone);
    const data = await buildDataContext(tx, {
      clientId: dashboard.clientId,
      clientCurrency: dashboard.client.currency,
      clientTimezone: dashboard.client.timezone,
      range,
      filters: dashboardFilters(settings),
    });
    // Rapportens källor: de som widgetarna använder, plus rapportens standardkällor.
    const used = new Set([
      ...dashboard.widgets.filter((w) => WIDGET_META[w.type as WidgetType]?.needsData).flatMap((w) => w.sources.map((s) => s.accountId)),
      ...(settings.sources ?? []),
    ]);
    const sources = data.accounts.filter((a) => used.has(a.id));
    if (!sources.length) throw new Error("Rapporten har inga källor att analysera. Välj källor under Rapportens källor.");
    const input = await buildInsightInput(tx, {
      ctx: data,
      sources,
      brief: parseBrief(dashboard.client.brief),
      goals: await loadGoalProgress(tx, data),
      clientName: dashboard.client.name,
      dashboardName: dashboard.name,
      currency: dashboard.client.currency,
    });
    return { input, range, clientId: dashboard.clientId };
  });
}

/** Kundvänligt utkast till sammanfattning för rapportens period (byrån granskar innan publicering). */
export async function draftClientSummary(dashboardId: string, searchParams: Record<string, string>) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    if (!aiConfigured()) throw new Error("AI är inte aktiverad: ANTHROPIC_API_KEY saknas i .env.");
    const prepared = await prepareInput(ctx, dashboardId, searchParams);
    try {
      const { text } = await generateClientSummary(prepared.input);
      return { ok: true as const, data: text };
    } catch (e) {
      console.error("AI-sammanfattning misslyckades", e);
      const status = (e as { status?: number }).status;
      throw new Error(status === 401 ? "AI-nyckeln godkändes inte." : status === 429 || status === 529 ? "AI-tjänsten är överbelastad. Försök igen om en stund." : "Kunde inte skriva sammanfattningen just nu.");
    }
  });
}
