import { addDays, computeDelta, computeMetric, describeFilter, formatMetric, PLATFORMS, todayInTimezone, type GoalPeriod, type MetricId, type PlatformId } from "@rp/core";
import { Database, LayoutDashboard, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { worstStatus } from "@/lib/status";
import { ClientTabs } from "./client-tabs";
import { PlatformIcon } from "@/components/platform-icon";
import { buildCatalog } from "@/lib/catalog";
import { requireWorkspace } from "@/lib/dal";
import { initials, timeAgo } from "@/lib/format";
import { loadClientSourceTotals, parseSourceFilters } from "@/lib/source-facts";
import { parseBrief } from "@/lib/ai/brief";
import { AccountRow, type AccountHeadline } from "./account-row";
import { BriefCard } from "./brief-card";
import { GoalsCard } from "./goals-card";
import { AlertsCard } from "./alerts-card";
import { buildDataContext } from "@/lib/dashboard-data";
import { loadGoalProgress } from "@/lib/goals";

/** Vanliga mål först i listan. */
const GOAL_METRIC_ORDER: MetricId[] = ["spend", "conversions", "cpa", "roas", "conversion_value", "sessions", "clicks", "ctr", "cpc", "impressions", "cpm", "conversion_rate", "users"];
import { SourcePicker, type PickableSource } from "./source-picker";
import { ClientMenu } from "./client-menu";
import { ClientSettingsDialog } from "./client-settings-dialog";
import { NewDashboardDialog } from "./new-dashboard-dialog";
import { OAuthToast } from "./oauth-toast";
import { Suspense } from "react";

/** Vilken siffra som visas som "senaste 30 dagarna" per plattform i kontolistan. */
const HEADLINE: Record<PlatformId, MetricId[]> = {
  ga4: ["sessions", "bounce_rate"],
  google_ads: ["spend", "clicks", "ctr"],
  meta_ads: ["spend", "impressions", "ctr"],
  linkedin_ads: ["spend", "impressions", "engagement_rate"],
  tiktok_ads: ["spend", "video_views", "cpm"],
};

export async function generateMetadata({ params }: PageProps<"/clients/[clientSlug]">) {
  const { clientSlug } = await params;
  const ctx = await requireWorkspace();
  const client = await ctx.tx((tx) => tx.client.findUnique({ where: { workspaceId_slug: { workspaceId: ctx.workspace.id, slug: clientSlug } }, select: { name: true } }));
  return { title: client?.name ?? "Kund" };
}

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[clientSlug]">) {
  const { clientSlug } = await params;
  const sp = (await searchParams) as Record<string, string | undefined>;
  const ctx = await requireWorkspace();
  const catalog = buildCatalog();

  const data = await ctx.tx(async (tx) => {
    const client = await tx.client.findUnique({
      where: { workspaceId_slug: { workspaceId: ctx.workspace.id, slug: clientSlug } },
      include: {
        sources: { include: { account: true }, orderBy: [{ account: { platform: "asc" } }, { account: { name: "asc" } }] },
        dashboards: { orderBy: { updatedAt: "desc" }, include: { _count: { select: { widgets: true } } } },
      },
    });
    if (!client) return null;
    const end = todayInTimezone(client.timezone);
    const start = addDays(end, -59);
    const facts = await loadClientSourceTotals(
      tx,
      client.sources.map((s) => ({ accountId: s.accountId, platform: s.account.platform as PlatformId, filters: parseSourceFilters(s.filters) })),
      catalog,
      start,
      end,
    );
    // Mål med utfall för innevarande period.
    const goalCtx = await buildDataContext(tx, {
      clientId: client.id,
      clientCurrency: client.currency,
      clientTimezone: client.timezone,
      range: { preset: "custom", range: { start: end, end }, compare: "previous_period", compareRange: null },
    });
    const goals = await tx.clientGoal.findMany({ where: { clientId: client.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    const goalProgress = await loadGoalProgress(tx, goalCtx);
    const goalPlatforms = new Set(goalCtx.accounts.map((a) => a.platform));
    const goalMetrics = [
      ...new Set([...GOAL_METRIC_ORDER, ...[...goalPlatforms].flatMap((p) => goalCtx.catalog[p]?.metrics ?? [])].filter((m) => [...goalPlatforms].some((p) => goalCtx.catalog[p]?.metrics.includes(m as MetricId)))),
      ...goalCtx.registry.customList().map((c) => c.id),
    ].map((id) => ({ id, label: goalCtx.registry.meta(id).label }));
    const templates = await tx.dashboardTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, definition: true } });
    // Byråns källor att välja bland (aktiva inloggningar), med vilka kunder som redan använder dem.
    const pickable = await tx.connectedAccount.findMany({
      where: { connection: { status: "ACTIVE" } },
      orderBy: [{ platform: "asc" }, { name: "asc" }],
      select: { id: true, name: true, externalId: true, platform: true, connection: { select: { label: true } }, clientSources: { select: { clientId: true, client: { select: { name: true } } } } },
    });
    const alertRules = await tx.alertRule.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } });
    const members = await tx.membership.findMany({ where: { workspaceId: ctx.workspace.id, role: { not: "CLIENT" } }, select: { role: true, user: { select: { id: true, name: true, email: true } } } });
    return { client, facts, end, templates, pickable, goals, goalProgress, goalMetrics, alertRules, members, registry: goalCtx.registry };
  });
  if (!data) notFound();
  const { client, facts, end, templates, pickable, goals, goalProgress, goalMetrics, alertRules, members, registry } = data;
  const goalLabel = (id: string | null) => {
    const g = goals.find((x) => x.id === id);
    return g ? (g.label ?? registry.meta(g.metric).label) : "Borttaget mål";
  };
  const windowLabel = { yesterday: "i går", last_7: "senaste 7 dagarna", month_to_date: "hittills denna månad" } as Record<string, string>;

  // Summera senaste 30 dagarna mot de 30 dagarna innan, per konto.
  const splitDate = new Date(addDays(end, -29));
  const sums = new Map<string, { cur: Record<string, number>; prev: Record<string, number> }>();
  for (const f of facts) {
    const s = sums.get(f.accountId) ?? { cur: {}, prev: {} };
    const bucket = f.date >= splitDate ? s.cur : s.prev;
    for (const [k, v] of Object.entries(f.metrics as Record<string, number>)) bucket[k] = (bucket[k] ?? 0) + v;
    sums.set(f.accountId, s);
  }

  const accounts = client.sources.map(({ account: a, filters }) => {
    const s = sums.get(a.id);
    const headline: AccountHeadline[] = (HEADLINE[a.platform as PlatformId] ?? []).map((metric) => {
      const cur = s ? computeMetric(metric, s.cur) : null;
      const prev = s ? computeMetric(metric, s.prev) : null;
      return { metric, value: cur, delta: computeDelta(metric, cur, prev) };
    });
    return {
      id: a.id,
      name: a.name,
      platform: a.platform,
      connectorId: a.connectorId,
      externalId: a.externalId,
      currency: a.currency,
      status: a.status,
      statusMessage: a.statusMessage,
      lastSynced: timeAgo(a.lastSyncedAt),
      headline,
      filters: parseSourceFilters(filters),
      filterLabels: parseSourceFilters(filters).map((f) => describeFilter({ ...f, platform: undefined })),
      sharedWith: pickable.find((p) => p.id === a.id)?.clientSources.filter((c) => c.clientId !== client.id).map((c) => c.client.name) ?? [],
    };
  });

  const platforms = [...new Set(client.sources.map((s) => s.account.platform))] as PlatformId[];
  const sources: PickableSource[] = pickable.map((p) => ({
    id: p.id,
    name: p.name,
    externalId: p.externalId,
    platform: p.platform as PlatformId,
    login: p.connection.label,
    chosen: p.clientSources.some((c) => c.clientId === client.id),
    usedBy: p.clientSources.filter((c) => c.clientId !== client.id).map((c) => c.client.name),
  }));

  const worst = worstStatus(client.sources.map((s) => s.account.status));
  const broken = client.sources.filter((s) => s.account.status === "AUTH_REQUIRED" || s.account.status === "SYNC_ERROR").length;
  const lastSync = client.sources.reduce<Date | null>((max, s) => (s.account.lastSyncedAt && (!max || s.account.lastSyncedAt > max) ? s.account.lastSyncedAt : max), null);
  const canPick = ctx.can("EDITOR") && !ctx.clientIds;
  const templateList = templates.map((t) => ({ id: t.id, name: t.name, widgets: (t.definition as { widgets?: unknown[] }).widgets?.length ?? 0 }));

  const dashboardsPanel = (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ctx.can("EDITOR") && client.dashboards.length === 0 && (
        <li>
          <NewDashboardDialog clientId={client.id} clientSlug={client.slug} templates={templateList} trigger="tile" />
        </li>
      )}
      {client.dashboards.map((d) => (
        <li key={d.id}>
          <Link
            href={`/clients/${client.slug}/dashboards/${d.id}`}
            className="group flex h-full min-h-40 flex-col overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-border transition-all outline-none hover:-translate-y-0.5 hover:ring-heading/30 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="h-1.5" style={{ background: client.primaryColor }} aria-hidden />
            <span className="flex flex-1 flex-col p-5">
              <span className="text-h3 font-bold tracking-tight text-heading">{d.name}</span>
              {d.description && <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.description}</span>}
              <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-5 text-xs text-muted-foreground">
                <span>{d._count.widgets} widgets</span>
                <span>Ändrad {timeAgo(d.updatedAt)}</span>
                {d.inPortal && <span>I kundportalen</span>}
              </span>
            </span>
          </Link>
        </li>
      ))}
      {client.dashboards.length === 0 && !ctx.can("EDITOR") && (
        <li className="sm:col-span-2 xl:col-span-3">
          <EmptyState icon={<LayoutDashboard />} title="Inga dashboards än" text="Det finns inga rapporter för kunden ännu." />
        </li>
      )}
    </ul>
  );

  const sourcesPanel = (
    <section aria-label="Källor" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{accounts.length ? "Siffrorna visar senaste 30 dagarna mot de 30 innan." : ""}</p>
        {canPick && accounts.length > 0 && <SourcePicker clientId={client.id} clientName={client.name} sources={sources} isAdmin={ctx.can("ADMIN")} />}
      </div>
      {accounts.length === 0 ? (
        <EmptyState
          icon={<Database />}
          title="Inga källor valda än"
          text="Välj kundens konton i GA4, Google Ads, Meta, LinkedIn eller TikTok bland byråns databaser."
          action={canPick && <SourcePicker clientId={client.id} clientName={client.name} sources={sources} isAdmin={ctx.can("ADMIN")} primary />}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-border">
          {accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              platformLabel={PLATFORMS[a.platform as PlatformId]?.label ?? a.platform}
              clientCurrency={client.currency}
              clientId={client.id}
              canEdit={ctx.can("EDITOR")}
              isAdmin={ctx.can("ADMIN")}
              catalog={catalog}
            />
          ))}
        </ul>
      )}
    </section>
  );

  const goalsPanel = (
    <div className="space-y-6">
      <GoalsCard
        clientId={client.id}
        currency={client.currency}
        goals={goals.map((g) => ({
          id: g.id,
          label: g.label,
          metric: g.metric,
          target: g.target,
          period: g.period as GoalPeriod,
          accountIds: g.accountIds,
          startDate: g.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: g.endDate?.toISOString().slice(0, 10) ?? null,
          group: g.group,
          campaignContains: ((g.filters as { dimension: string; op: string; values: string[] }[] | null) ?? []).filter((f) => f.dimension === "campaign" && f.op === "contains").flatMap((f) => f.values),
        }))}
        progress={goalProgress}
        metrics={goalMetrics}
        sources={client.sources.map((s) => ({ id: s.account.id, name: s.account.name, platform: s.account.platform as PlatformId }))}
        canEdit={ctx.can("EDITOR")}
      />
      <AlertsCard
        clientId={client.id}
        rules={alertRules.map((r) => ({
          id: r.id,
          kind: r.kind as "metric" | "goal",
          metric: r.metric,
          op: r.op as "above" | "below" | null,
          threshold: r.threshold,
          window: r.window,
          goalId: r.goalId,
          accountIds: r.accountIds,
          recipientIds: r.recipientIds,
          active: r.active,
          firing: r.firing,
          lastChecked: r.lastCheckedAt ? timeAgo(r.lastCheckedAt) : null,
          summary:
            r.kind === "goal"
              ? `${goalLabel(r.goalId)} ligger efter eller överförbrukar`
              : `${registry.meta(r.metric ?? "").label} ${windowLabel[r.window] ?? ""} ${r.op === "above" ? "över" : "under"} ${formatMetric(registry.meta(r.metric ?? ""), r.threshold, client.currency)}`,
        }))}
        metrics={goalMetrics}
        goals={goals.map((g) => ({ id: g.id, label: goalLabel(g.id) }))}
        sources={client.sources.map((s) => ({ id: s.account.id, name: s.account.name, platform: s.account.platform as PlatformId }))}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, admin: m.role === "ADMIN" }))}
        canEdit={ctx.can("EDITOR")}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <Suspense>
        <OAuthToast />
      </Suspense>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          {client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logoUrl} alt="" className="h-14 max-w-40 rounded-xl bg-card object-contain p-2 shadow-soft" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white" style={{ background: client.primaryColor }} aria-hidden>
              {initials(client.name)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-h1 font-bold tracking-tight text-heading">{client.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {worst && <StatusBadge status={worst} />}
              <span className="inline-flex items-center gap-1">
                {platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} size="sm" />
                ))}
                <span className="ml-1">
                  {client.sources.length} {client.sources.length === 1 ? "källa" : "källor"}
                </span>
              </span>
              <span>Synkad {timeAgo(lastSync)}</span>
              <span>
                {client.currency} · {client.timezone.replace("Europe/", "")}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/portal">
              <LayoutGrid /> Förhandsvisa portal
            </Link>
          </Button>
          {ctx.can("EDITOR") && (
            <ClientSettingsDialog
              client={{
                id: client.id,
                name: client.name,
                currency: client.currency,
                timezone: client.timezone,
                locale: client.locale,
                primaryColor: client.primaryColor,
                accentColor: client.accentColor,
                logoUrl: client.logoUrl,
              }}
            />
          )}
          {ctx.can("EDITOR") && <NewDashboardDialog clientId={client.id} clientSlug={client.slug} templates={templateList} trigger="primary" defaultOpen={sp.ny === "dashboard"} />}
          {ctx.can("ADMIN") && <ClientMenu clientId={client.id} clientName={client.name} />}
        </div>
      </header>

      <ClientTabs
        tabs={[
          { id: "dashboards", label: "Dashboards", count: client.dashboards.length, content: dashboardsPanel },
          { id: "kallor", label: "Källor", count: client.sources.length, alert: broken > 0, content: sourcesPanel },
          { id: "mal", label: "Mål och larm", count: goals.length + alertRules.length, content: goalsPanel },
          { id: "profil", label: "Kundprofil", content: <BriefCard clientId={client.id} brief={parseBrief(client.brief)} canEdit={ctx.can("EDITOR")} /> },
        ]}
      />
    </div>
  );
}
