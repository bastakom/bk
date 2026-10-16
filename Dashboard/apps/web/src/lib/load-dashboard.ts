import "server-only";
import { briefIsEmpty, parseBrief } from "./ai/brief";
import type { WidgetConfig, WidgetLayout, WidgetType } from "@rp/core";
import { langOf, WIDGET_META, widgetConfigSchema } from "@rp/core";
import { hideMissingSources } from "./missing-sources";
import type { TenantTx } from "@rp/db";
import { buildDataContext, dashboardFilters, loadClientAccounts, loadWidgetData, resolveDashboardRange, type AccountInfo, type Audience, type DashboardSettings, type WidgetData } from "@/lib/dashboard-data";

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string | null;
  config: WidgetConfig;
  layout: WidgetLayout;
  accountIds: string[];
  data: WidgetData | null;
  /** Datawidget där ingen av widgetens källor finns hos kunden (t.ex. från en mall). */
  missingSource: boolean;
}

/** Laddar en dashboard med alla widgets och deras data för vald period. */
/**
 * @param audience "internal" i appen; "client" (standard) på delade länkar, i PDF och utskick –
 *   då visas inga interna händelser och inga opublicerade sammanfattningar.
 */
export async function loadDashboard(tx: TenantTx, params: { clientSlug?: string; dashboardId: string; searchParams: Record<string, string | string[] | undefined>; audience?: Audience }) {
  const audience = params.audience ?? "client";
  const dashboard = await tx.dashboard.findFirst({
    where: { id: params.dashboardId, ...(params.clientSlug ? { client: { slug: params.clientSlug } } : {}) },
    include: { client: true, widgets: { include: { sources: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!dashboard) return null;

  const accountRows = await loadClientAccounts(tx, dashboard.clientId);
  const accounts: AccountInfo[] = accountRows.map((a) => ({ id: a.id, name: a.name, platform: a.platform, currency: a.currency, timezone: a.timezone, dataFrom: a.dataFrom, filters: a.filters }));
  const settings = (dashboard.settings ?? {}) as DashboardSettings;
  const range = resolveDashboardRange(params.searchParams, settings, dashboard.client.timezone);
  const ctx = await buildDataContext(tx, {
    clientId: dashboard.clientId,
    clientCurrency: dashboard.client.currency,
    clientTimezone: dashboard.client.timezone,
    range,
    accounts,
    filters: dashboardFilters(settings),
    audience,
    // Kunden ser rapporten på sitt språk; appen är på svenska.
    lang: audience === "client" ? langOf(dashboard.client.locale) : "sv",
  });
  const catalog = ctx.catalog;
  const customMetrics = ctx.registry.customList();

  let widgets: DashboardWidget[] = [];
  for (const w of dashboard.widgets) {
    const config = widgetConfigSchema.parse(w.config ?? {});
    // Opublicerade sammanfattningar visas aldrig för kunden.
    if (audience === "client" && w.type === "summary" && config.summaryStatus !== "published") continue;
    const accountIds = w.sources.map((s) => s.accountId);
    const missingSource = WIDGET_META[w.type as WidgetType].needsData && w.type !== "goal" && !accountIds.some((id) => accounts.some((a) => a.id === id));
    widgets.push({
      missingSource,
      id: w.id,
      type: w.type as WidgetType,
      title: w.title,
      config,
      layout: w.layout as WidgetLayout,
      accountIds,
      data: await loadWidgetData(tx, { type: w.type as WidgetType, config, accountIds }, ctx),
    });
  }

  // Kunden (delad länk, portal, PDF) ser aldrig tomma widgets utan källa.
  if (audience === "client") widgets = hideMissingSources(widgets).visible;

  const usedIds = new Set(widgets.flatMap((w) => w.accountIds));
  const used = accountRows.filter((a) => usedIds.has(a.id));
  const lastSynced = used.reduce<Date | null>((min, a) => (a.lastSyncedAt && (!min || a.lastSyncedAt < min) ? a.lastSyncedAt : min), null);

  return {
    audience,
    lang: ctx.lang,
    /** Händelser i perioden (för kunden: bara icke-interna) */
    annotations: ctx.annotations,
    dashboard: { id: dashboard.id, name: dashboard.name, inPortal: dashboard.inPortal, settings: { ...settings, filters: dashboardFilters(settings) } },
    client: {
      id: dashboard.client.id,
      name: dashboard.client.name,
      slug: dashboard.client.slug,
      currency: dashboard.client.currency,
      primaryColor: dashboard.client.primaryColor,
      accentColor: dashboard.client.accentColor,
      logoUrl: dashboard.client.logoUrl,
      /** Intern brief ifylld (för AI-analysen) */
      hasBrief: !briefIsEmpty(parseBrief(dashboard.client.brief)),
    },
    accounts,
    accountStatus: accountRows.map((a) => ({ id: a.id, status: a.status })),
    catalog,
    customMetrics,
    goals: (await tx.clientGoal.findMany({ where: { clientId: dashboard.clientId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })).map((g) => ({
      id: g.id,
      label: g.label ?? ctx.registry.meta(g.metric).label,
    })),
    range,
    widgets,
    lastSynced: lastSynced?.toISOString() ?? null,
    // Plattformarna rapporterar dagar i kontots tidszon; avvikelser visas en gång för hela dashboarden.
    timezoneNotes: [...new Set(used.filter((a) => a.timezone !== dashboard.client.timezone).map((a) => `${a.name} (${a.timezone})`))],
    clientTimezone: dashboard.client.timezone,
    brokenSources: used.filter((a) => a.status === "AUTH_REQUIRED" || a.status === "SYNC_ERROR").map((a) => a.name),
  };
}

export type LoadedDashboard = NonNullable<Awaited<ReturnType<typeof loadDashboard>>>;
