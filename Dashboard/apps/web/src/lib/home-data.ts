/**
 * Startsidan (Kunder): läget för hela byrån.
 *  - Annonsbudget hittills i månaden mot samma dagar förra månaden, omräknat till byråns valuta.
 *  - Per kund: ett nyckeltal för senaste 30 dagarna (spend för annonskanaler, annars besök) med daglig kurva.
 *  - Att göra och kommande utskick.
 */
import "server-only";
import { addDays, todayInTimezone, type PlatformId } from "@rp/core";
import { loadFxTable, type AccountStatus, type TenantTx } from "@rp/db";
import { buildCatalog } from "./catalog";
import { loadClientSourceTotals, parseSourceFilters } from "./source-facts";
import { worstStatus } from "./status";

const AD_PLATFORMS: PlatformId[] = ["google_ads", "meta_ads", "linkedin_ads", "tiktok_ads"];
const TZ = "Europe/Stockholm";

export interface ClientHeadline {
  metric: "spend" | "sessions";
  label: string;
  value: number;
  previous: number;
  currency: string | null;
  series: number[];
}

export interface HomeClient {
  id: string;
  slug: string;
  name: string;
  primaryColor: string;
  logoUrl: string | null;
  currency: string;
  dashboards: number;
  latest: { id: string; name: string } | null;
  status: AccountStatus | null;
  lastSyncedAt: string | null;
  accounts: { id: string; platform: string; name: string; status: AccountStatus; statusMessage: string | null; lastSyncedAt: string | null }[];
  headline: ClientHeadline | null;
  nextDelivery: string | null;
}

export interface TodoItem {
  id: string;
  tone: "warning" | "neutral";
  title: string;
  text: string;
  href: string;
}

export async function loadHome(tx: TenantTx) {
  const catalog = buildCatalog();
  const today = todayInTimezone(TZ);
  const yesterday = addDays(today, -1);
  const from60 = addDays(yesterday, -59);
  const monthStart = `${today.slice(0, 8)}01`;
  const prevMonthStart = (() => {
    const d = new Date(`${monthStart}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const dayOfMonth = Number(today.slice(8, 10));
  const prevMonthSameDay = addDays(prevMonthStart, dayOfMonth - 1);

  const clients = await tx.client.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    include: {
      sources: { include: { account: { select: { id: true, platform: true, name: true, status: true, statusMessage: true, lastSyncedAt: true, currency: true } } } },
      dashboards: { orderBy: { updatedAt: "desc" }, select: { id: true, name: true } },
      goals: { select: { id: true }, take: 1 },
    },
  });
  const nextRuns = await tx.reportSchedule.findMany({ where: { active: true }, orderBy: { nextRunAt: "asc" }, select: { clientId: true, nextRunAt: true } });
  const nextByClient = new Map<string, Date>();
  for (const r of nextRuns) if (!nextByClient.has(r.clientId)) nextByClient.set(r.clientId, r.nextRunAt);

  const allSources = clients.flatMap((c) => c.sources.map((s) => ({ accountId: s.accountId, platform: s.account.platform as PlatformId, filters: parseSourceFilters(s.filters) })));
  const uniqueSources = [...new Map(allSources.map((s) => [`${s.accountId}:${JSON.stringify(s.filters)}`, s])).values()];
  const facts = uniqueSources.length ? await loadClientSourceTotals(tx, uniqueSources, catalog, prevMonthStart < from60 ? prevMonthStart : from60, today) : [];
  const fx = await loadFxTable(tx, prevMonthStart, today);
  const homeCurrency = mostCommon(clients.map((c) => c.currency)) ?? "SEK";
  const accountCurrency = new Map(clients.flatMap((c) => c.sources.map((s) => [s.accountId, s.account.currency] as const)));

  // Dagliga summor per konto och metric.
  const daily = new Map<string, Map<string, Record<string, number>>>();
  for (const f of facts) {
    const day = f.date.toISOString().slice(0, 10);
    const acc = daily.get(f.accountId) ?? new Map();
    const row = acc.get(day) ?? {};
    for (const [k, v] of Object.entries(f.metrics as Record<string, number>)) if (typeof v === "number") row[k] = (row[k] ?? 0) + v;
    acc.set(day, row);
    daily.set(f.accountId, acc);
  }
  const conv = (amount: number, from: string, day: string) => (from === homeCurrency ? amount : amount * (fx.rate(from, homeCurrency, day) ?? 0));

  // Annonsbudget hittills i månaden, och samma antal dagar förra månaden.
  const adAccounts = new Set(clients.flatMap((c) => c.sources.filter((s) => AD_PLATFORMS.includes(s.account.platform as PlatformId)).map((s) => s.accountId)));
  const monthDays: string[] = [];
  for (let d = monthStart; d <= today; d = addDays(d, 1)) monthDays.push(d);
  const spendOn = (day: string) => [...adAccounts].reduce((sum, id) => sum + conv(daily.get(id)?.get(day)?.spend ?? 0, accountCurrency.get(id) ?? homeCurrency, day), 0);
  let prevSpend = 0;
  for (let d = prevMonthStart; d <= prevMonthSameDay; d = addDays(d, 1)) prevSpend += spendOn(d);
  const spendSeries = monthDays.map(spendOn);
  let running = 0;
  const cumulative = spendSeries.map((v) => (running += v));
  const budget = adAccounts.size ? { value: running, previous: prevSpend, currency: homeCurrency, series: cumulative, month: today.slice(0, 7) } : null;

  const last30: string[] = [];
  for (let d = addDays(yesterday, -29); d <= yesterday; d = addDays(d, 1)) last30.push(d);
  const prev30Start = addDays(yesterday, -59);

  const rows: HomeClient[] = clients.map((c) => {
    const accs = c.sources.map((s) => s.account);
    const ad = accs.filter((a) => AD_PLATFORMS.includes(a.platform as PlatformId));
    const ga = accs.filter((a) => a.platform === "ga4");
    let headline: ClientHeadline | null = null;
    const pick = ad.length ? { metric: "spend" as const, label: "Spend", list: ad } : ga.length ? { metric: "sessions" as const, label: "Besök", list: ga } : null;
    if (pick) {
      const valueOn = (day: string) =>
        pick.list.reduce((s, a) => {
          const v = daily.get(a.id)?.get(day)?.[pick.metric] ?? 0;
          return s + (pick.metric === "spend" ? (a.currency === c.currency ? v : v * (fx.rate(a.currency, c.currency, day) ?? 0)) : v);
        }, 0);
      const series = last30.map(valueOn);
      let previous = 0;
      for (let d = prev30Start; d < last30[0]!; d = addDays(d, 1)) previous += valueOn(d);
      headline = { metric: pick.metric, label: pick.label, value: series.reduce((a, b) => a + b, 0), previous, currency: pick.metric === "spend" ? c.currency : null, series };
    }
    const lastSync = accs.reduce<Date | null>((m, a) => (a.lastSyncedAt && (!m || a.lastSyncedAt > m) ? a.lastSyncedAt : m), null);
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      primaryColor: c.primaryColor,
      logoUrl: c.logoUrl,
      currency: c.currency,
      dashboards: c.dashboards.length,
      latest: c.dashboards[0] ?? null,
      status: worstStatus(accs.map((a) => a.status)),
      lastSyncedAt: lastSync?.toISOString() ?? null,
      accounts: accs.map((a) => ({ id: a.id, platform: a.platform, name: a.name, status: a.status, statusMessage: a.statusMessage, lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null })),
      headline,
      nextDelivery: nextByClient.get(c.id)?.toISOString() ?? null,
    };
  });

  // Att göra: det som hindrar bra rapporter, viktigast först.
  const todo: TodoItem[] = [];
  for (const c of clients)
    for (const s of c.sources)
      if (s.account.status === "AUTH_REQUIRED" || s.account.status === "SYNC_ERROR")
        todo.push({ id: `src-${s.accountId}-${c.id}`, tone: "warning", title: s.account.status === "AUTH_REQUIRED" ? `Koppla om ${s.account.name}` : `Synkfel i ${s.account.name}`, text: c.name, href: "/databases" });
  for (const c of clients) if (!c.sources.length) todo.push({ id: `nosrc-${c.id}`, tone: "neutral", title: `Välj källor för ${c.name}`, text: "Kunden har inga konton än", href: `/clients/${c.slug}?tab=kallor` });
  for (const c of clients) if (c.sources.length && !c.dashboards.length) todo.push({ id: `nodash-${c.id}`, tone: "neutral", title: `Skapa en dashboard för ${c.name}`, text: "Källorna är klara", href: `/clients/${c.slug}?ny=dashboard` });
  for (const c of clients) if (c.sources.length && !c.goals.length) todo.push({ id: `goal-${c.id}`, tone: "neutral", title: `Lägg in mål för ${c.name}`, text: "Ger målwidget, larm och bättre AI-analys", href: `/clients/${c.slug}?tab=mal` });

  const [schedules, weekStats, links] = await Promise.all([
    tx.reportSchedule.findMany({
      where: { active: true },
      orderBy: { nextRunAt: "asc" },
      take: 4,
      select: { id: true, nextRunAt: true, recipients: true, dashboard: { select: { id: true, name: true, client: { select: { name: true, slug: true } } } } },
    }),
    (async () => {
      const now = new Date();
      const monday = new Date(now);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const sunday = new Date(monday.getTime() + 7 * 86_400_000);
      const [sent, outbox, upcoming] = await Promise.all([
        tx.reportDelivery.count({ where: { status: "SENT", provider: { not: "outbox" }, createdAt: { gte: monday } } }),
        // Hamnade i den lokala utkorgen (ingen e-posttjänst kopplad) – inte skickade.
        tx.reportDelivery.count({ where: { status: "SENT", provider: "outbox", createdAt: { gte: monday } } }),
        tx.reportSchedule.count({ where: { active: true, nextRunAt: { gte: now, lt: sunday } } }),
      ]);
      return { sent, outbox, upcoming };
    })(),
    tx.shareLink.aggregate({ where: { revokedAt: null }, _sum: { viewCount: true }, _count: true }),
  ]);

  const broken = clients.flatMap((c) => c.sources).filter((s) => s.account.status === "AUTH_REQUIRED" || s.account.status === "SYNC_ERROR").length;
  const lastSyncAll = rows.reduce<string | null>((m, r) => (r.lastSyncedAt && (!m || r.lastSyncedAt > m) ? r.lastSyncedAt : m), null);

  return {
    rows,
    budget,
    broken,
    week: weekStats,
    links: { views: links._sum.viewCount ?? 0, count: links._count },
    todo: todo.slice(0, 6),
    schedules: schedules.map((s) => ({ id: s.id, at: s.nextRunAt.toISOString(), recipients: s.recipients.length, dashboard: s.dashboard.name, client: s.dashboard.client.name, href: `/clients/${s.dashboard.client.slug}/dashboards/${s.dashboard.id}` })),
    lastSync: lastSyncAll,
  };
}

function mostCommon(list: string[]): string | null {
  const counts = new Map<string, number>();
  for (const x of list) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
