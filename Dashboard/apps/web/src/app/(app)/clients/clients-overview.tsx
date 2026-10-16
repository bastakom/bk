"use client";

import { computeDelta, formatMetric, type MetricId } from "@rp/core";
import { ArrowRight, Database, LayoutGrid, List, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { DeltaBadge } from "@/components/delta-badge";
import { PlatformIcon } from "@/components/platform-icon";
import { Sparkline } from "@/components/sparkline";
import { StatusBadge, StatusShape } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { HomeClient, TodoItem } from "@/lib/home-data";
import { initials, timeAgo } from "@/lib/format";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { NewClientDialog } from "./new-client-dialog";

type Filter = "all" | "attention" | "empty";
const VIEW_KEY = "rp_clients_view";
const readView = (): "cards" | "list" => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
};
const subscribeView = (cb: () => void) => {
  window.addEventListener(VIEW_KEY, cb);
  return () => window.removeEventListener(VIEW_KEY, cb);
};
const needsAttention = (r: HomeClient) => r.status === "AUTH_REQUIRED" || r.status === "SYNC_ERROR";
const dateFmt = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" });
const monthFmt = new Intl.DateTimeFormat("sv-SE", { month: "long" });

interface Props {
  rows: HomeClient[];
  budget: { value: number; previous: number; currency: string; series: number[]; month: string } | null;
  broken: number;
  week: { sent: number; outbox: number; upcoming: number };
  links: { views: number; count: number };
  todo: TodoItem[];
  schedules: { id: string; at: string; recipients: number; dashboard: string; client: string; href: string }[];
  lastSync: string | null;
  userName: string;
  canEdit: boolean;
  canPick: boolean;
  isAdmin: boolean;
  canCreate: boolean;
  openNew: boolean;
}

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("sv-SE", { hour: "numeric", timeZone: "Europe/Stockholm" }).format(now));
  return h < 10 ? "God morgon" : h < 18 ? "Hej" : "God kväll";
}

export function HomeView(p: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const view = useSyncExternalStore(subscribeView, readView, () => "cards" as const);
  const setView = (v: "cards" | "list") => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
    window.dispatchEvent(new Event(VIEW_KEY));
  };
  const counts = { all: p.rows.length, attention: p.rows.filter(needsAttention).length, empty: p.rows.filter((r) => !r.accounts.length).length };
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return p.rows.filter((r) => {
      if (filter === "attention" && !needsAttention(r)) return false;
      if (filter === "empty" && r.accounts.length) return false;
      return !q || r.name.toLowerCase().includes(q) || r.accounts.some((a) => a.name.toLowerCase().includes(q));
    });
  }, [p.rows, query, filter]);
  const dashboards = p.rows.reduce((s, r) => s + r.dashboards, 0);
  const today = new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Stockholm" }).format(new Date());

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase" suppressHydrationWarning>
            {today}
          </p>
          <h1 className="mt-1.5 text-[34px] leading-tight font-extrabold tracking-[-0.035em] text-heading" suppressHydrationWarning>
            {greeting()}, {p.userName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {p.rows.length} kunder · {dashboards} dashboards · {p.lastSync ? `senast synkad ${timeAgo(new Date(p.lastSync))}` : "inga källor synkade än"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.isAdmin && (
            <Button asChild variant="outline" size="lg">
              <Link href="/databases?koppla=1">
                <Database /> Koppla källa
              </Link>
            </Button>
          )}
          {p.canCreate && <NewClientDialog defaultOpen={p.openNew} />}
        </div>
      </header>

      <section aria-label="Läget" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="flex flex-col overflow-hidden rounded-[18px] p-5 pb-0 text-white shadow-soft" style={{ background: "var(--hero)" }}>
          <p className="text-[13px] font-semibold text-white/75">Annonsbudget i {p.budget ? monthFmt.format(new Date(`${p.budget.month}-01`)) : "månaden"}</p>
          {p.budget ? (
            <>
              <p className="tabular mt-2 text-[34px] leading-tight font-extrabold tracking-[-0.03em]">{formatMetric("spend", p.budget.value, p.budget.currency)}</p>
              <p className="mt-2 flex items-center gap-2 text-[12.5px] text-white/80">
                <DeltaBadge metric="spend" delta={computeDelta("spend", p.budget.value, p.budget.previous)} className="bg-white/14 text-white" />
                mot samma dagar förra månaden
              </p>
              <Sparkline values={p.budget.series} tone="inverse" className="mt-auto -mx-5 h-12 w-[calc(100%+2.5rem)] pt-2" />
            </>
          ) : (
            <p className="mt-3 pb-5 text-sm text-white/80">Koppla en annonskanal för att se budgeten här.</p>
          )}
        </div>
        <Stat label="Behöver åtgärd" value={p.broken} chip={p.broken ? "Synkfel eller behörighet" : "Allt fungerar"} chipTone={p.broken ? "warning" : "success"} />
        <Stat
          label="Rapporter denna vecka"
          value={p.week.sent + p.week.outbox + p.week.upcoming}
          chip={p.week.outbox && !p.week.sent ? `${p.week.outbox} ej skickade` : `${p.week.sent} skickade`}
          chipTone={p.week.outbox && !p.week.sent ? "warning" : "success"}
          sub={`${p.week.upcoming} schemalagda`}
        />
        <Stat label="Visningar av delade länkar" value={p.links.views} chip={`${p.links.count} aktiva länkar`} chipTone="neutral" />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="clients-h" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="clients-h" className="mr-auto text-lg font-extrabold tracking-[-0.02em] text-heading">
              Kunder
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök kund eller konto …" className="h-10 pl-9" aria-label="Sök kund eller konto" />
            </div>
            <div className="flex rounded-[11px] bg-muted p-[3px]" role="group" aria-label="Filtrera kunder">
              {(
                [
                  ["all", "Alla"],
                  ["attention", "Behöver åtgärd"],
                  ["empty", "Utan källor"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filter === k}
                  onClick={() => setFilter(k)}
                  className={cn("rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", filter === k && "bg-card text-heading shadow-sm")}
                >
                  {l} <span className="tabular opacity-70">{counts[k]}</span>
                </button>
              ))}
            </div>
            <div className="flex rounded-[11px] bg-muted p-[3px]" role="group" aria-label="Visning">
              {(
                [
                  ["cards", LayoutGrid, "Kort"],
                  ["list", List, "Lista"],
                ] as const
              ).map(([v, Icon, l]) => (
                <button key={v} type="button" aria-label={l} aria-pressed={view === v} onClick={() => setView(v)} className={cn("grid size-8 place-items-center rounded-[9px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", view === v && "bg-card text-heading shadow-sm")}>
                  <Icon className="size-4" aria-hidden />
                </button>
              ))}
            </div>
          </div>

          {p.rows.length === 0 ? (
            <EmptyState icon={<Plus />} title="Inga kunder än" text="Lägg till din första kund och välj sedan dess källor och rapporter." />
          ) : list.length === 0 ? (
            <EmptyState icon={<Search />} title="Inga kunder matchar" text="Ändra sökningen eller filtret." action={<Button variant="outline" onClick={() => (setQuery(""), setFilter("all"))}>Visa alla kunder</Button>} />
          ) : view === "cards" ? (
            <ul className="grid gap-4 lg:grid-cols-2">
              {list.map((r) => (
                <li key={r.id}>
                  <ClientCard r={r} canEdit={p.canEdit} canPick={p.canPick} />
                </li>
              ))}
            </ul>
          ) : (
            <ClientTable rows={list} />
          )}
        </section>

        <aside className="space-y-4" aria-label="Att göra och utskick">
          <section className="rounded-[18px] border bg-card p-5 shadow-soft" aria-labelledby="todo-h">
            <h2 id="todo-h" className="text-lg font-extrabold tracking-[-0.02em] text-heading">
              Att göra
            </h2>
            {p.todo.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Inget just nu. Alla kunder har källor, dashboards och mål.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {p.todo.map((t) => (
                  <li key={t.id}>
                    <Link href={t.href} className="-mx-2 flex items-start gap-3 rounded-xl p-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                      <span className={cn("grid size-7 shrink-0 place-items-center rounded-[9px] text-xs font-extrabold", t.tone === "warning" ? "bg-warning-soft text-warning" : "bg-muted text-heading")} aria-hidden>
                        {t.tone === "warning" ? "!" : "+"}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-heading">{t.title}</span>
                        <span className="block text-xs text-muted-foreground">{t.text}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-[18px] border bg-card p-5 shadow-soft" aria-labelledby="sched-h">
            <h2 id="sched-h" className="text-lg font-extrabold tracking-[-0.02em] text-heading">
              Kommande utskick
            </h2>
            {p.schedules.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Inga schemalagda rapporter. Öppna en dashboard och välj Dela och exportera → Schemalägg.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {p.schedules.map((s) => {
                  const d = new Date(s.at);
                  return (
                    <li key={s.id}>
                      <Link href={s.href} className="-mx-2 flex items-center gap-3 rounded-xl p-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="grid h-12 w-11 shrink-0 place-items-center rounded-[11px] bg-muted text-center leading-none" aria-hidden>
                          <span>
                            <span className="block text-base font-extrabold text-heading">{d.getDate()}</span>
                            <span className="block text-[10px] font-bold text-muted-foreground uppercase">{dateFmt.format(d).split(" ")[1]}</span>
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-bold text-heading">{s.dashboard}</span>
                          <span className="block text-xs text-muted-foreground">
                            <span className="sr-only">{dateFmt.format(d)} · </span>
                            {s.client} · {s.recipients} {s.recipients === 1 ? "mottagare" : "mottagare"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, chip, chipTone, sub }: { label: string; value: number; chip: string; chipTone: "success" | "warning" | "neutral"; sub?: string }) {
  return (
    <div className="rounded-[18px] border bg-card p-5 shadow-soft">
      <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
      <p className="tabular mt-2 text-[34px] leading-tight font-extrabold tracking-[-0.03em] text-heading">{value.toLocaleString("sv-SE")}</p>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
        <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-bold", chipTone === "success" && "bg-success-soft text-success", chipTone === "warning" && "bg-warning-soft text-warning", chipTone === "neutral" && "bg-muted text-heading")}>{chip}</span>
        {sub}
      </p>
    </div>
  );
}

function ClientMark({ r, size = "lg" }: { r: HomeClient; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "size-11 rounded-[13px] text-sm" : "size-9 rounded-[10px] text-xs";
  return r.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={r.logoUrl} alt="" className={cn("shrink-0 bg-card object-contain p-1 ring-1 ring-border", cls)} />
  ) : (
    <span className={cn("grid shrink-0 place-items-center font-extrabold text-white", cls)} style={{ background: r.primaryColor }} aria-hidden>
      {initials(r.name)}
    </span>
  );
}

function SourceIcons({ r }: { r: HomeClient }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {r.accounts.map((a) => (
        <Tooltip key={a.id}>
          <TooltipTrigger asChild>
            <span className="relative inline-flex" tabIndex={0} aria-label={`${a.name}: ${STATUS_META[a.status].label}`}>
              <PlatformIcon platform={a.platform} size="sm" />
              {a.status !== "OK" && (
                <span className="absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full bg-card">
                  <StatusShape tone={STATUS_META[a.status].tone} className={cn("size-2", STATUS_META[a.status].tone === "warning" && "text-warning", STATUS_META[a.status].tone === "danger" && "text-destructive")} />
                </span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{a.name}</p>
            <p className="opacity-80">{STATUS_META[a.status].label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </span>
  );
}

function ClientCard({ r, canEdit, canPick }: { r: HomeClient; canEdit: boolean; canPick: boolean }) {
  const href = `/clients/${r.slug}`;
  const h = r.headline;
  return (
    <div className="relative flex h-full flex-col gap-4 rounded-[18px] border bg-card p-5 shadow-soft transition-all focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <ClientMark r={r} />
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-[17px] font-extrabold tracking-[-0.02em] text-heading outline-none after:absolute after:inset-0 after:rounded-[18px]">
            {r.name}
          </Link>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {r.dashboards} {r.dashboards === 1 ? "dashboard" : "dashboards"} · synkad {timeAgo(r.lastSyncedAt ? new Date(r.lastSyncedAt) : null)}
          </p>
        </div>
        {r.status && <StatusBadge status={r.status} className="relative shrink-0" />}
      </div>

      {h ? (
        <div className="grid grid-cols-2 items-center gap-3 rounded-[13px] bg-muted/70 p-3">
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-muted-foreground">{h.label} · 30 dagar</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="tabular text-lg font-extrabold tracking-[-0.02em] text-heading">{formatMetric(h.metric as MetricId, h.value, h.currency ?? undefined)}</span>
              <DeltaBadge metric={h.metric as MetricId} delta={computeDelta(h.metric as MetricId, h.value, h.previous)} size="sm" />
            </p>
          </div>
          <Sparkline values={h.series} className="h-9" />
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-[13px] bg-muted/70 p-3 text-sm text-muted-foreground">
          <Database className="size-4" aria-hidden /> Inga källor valda än
        </div>
      )}

      <div className="relative z-10 flex items-center gap-2 text-xs text-muted-foreground">
        <SourceIcons r={r} />
        {r.nextDelivery && <span className="ml-auto">Nästa utskick {dateFmt.format(new Date(r.nextDelivery))}</span>}
      </div>

      <div className="relative z-10 mt-auto flex flex-wrap gap-2 border-t pt-4">
        {r.latest ? (
          <Button asChild size="sm" className="h-8">
            <Link href={`${href}/dashboards/${r.latest.id}`} aria-label={`Öppna ${r.latest.name} för ${r.name}`}>
              Öppna rapport <ArrowRight />
            </Link>
          </Button>
        ) : (
          canEdit &&
          r.accounts.length > 0 && (
            <Button asChild size="sm" className="h-8">
              <Link href={`${href}?ny=dashboard`}>
                <Plus /> Ny dashboard
              </Link>
            </Button>
          )
        )}
        {r.latest && canEdit && (
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href={`${href}?ny=dashboard`} aria-label={`Ny dashboard för ${r.name}`}>
              <Plus /> Dashboard
            </Link>
          </Button>
        )}
        {canPick && r.accounts.length === 0 && (
          <Button asChild size="sm" className="h-8">
            <Link href={`${href}?tab=kallor`}>
              <Database /> Välj källor
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function ClientTable({ rows }: { rows: HomeClient[] }) {
  return (
    <div className="overflow-x-auto rounded-[18px] border bg-card shadow-soft">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">Kund</th>
            <th scope="col" className="px-3 py-3 font-semibold">Källor</th>
            <th scope="col" className="px-3 py-3 font-semibold">Status</th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">30 dagar</th>
            <th scope="col" className="px-3 py-3 font-semibold">Senast synkad</th>
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">Öppna</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="group relative hover:bg-muted/40">
              <td className="px-5 py-3">
                <span className="flex items-center gap-3">
                  <ClientMark r={r} size="md" />
                  <Link href={`/clients/${r.slug}`} className="font-bold text-heading outline-none after:absolute after:inset-0 focus-visible:underline">
                    {r.name}
                  </Link>
                </span>
              </td>
              <td className="relative z-10 px-3 py-3">{r.accounts.length ? <SourceIcons r={r} /> : <span className="text-muted-foreground">Inga</span>}</td>
              <td className="px-3 py-3">{r.status ? <StatusBadge status={r.status} /> : <span className="text-muted-foreground">–</span>}</td>
              <td className="tabular px-3 py-3 text-right">{r.headline ? `${r.headline.label} ${formatMetric(r.headline.metric as MetricId, r.headline.value, r.headline.currency ?? undefined)}` : "–"}</td>
              <td className="px-3 py-3 text-muted-foreground">{timeAgo(r.lastSyncedAt ? new Date(r.lastSyncedAt) : null)}</td>
              <td className="px-5 py-3">
                <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
