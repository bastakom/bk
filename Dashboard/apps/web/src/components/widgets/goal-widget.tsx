"use client";

import { useLang, useT } from "@/components/lang-context";
import { formatMetric, type GoalStatus } from "@rp/core";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { GoalProgress } from "@/lib/goals";
import type { WidgetViewProps } from "./types";

const TONE: Record<GoalStatus, { badge: string; bar: string }> = {
  on_track: { badge: "bg-success-soft text-success", bar: "bg-success" },
  close: { badge: "bg-warning-soft text-warning", bar: "bg-warning" },
  behind: { badge: "bg-danger-soft text-destructive", bar: "bg-destructive" },
  over_budget: { badge: "bg-danger-soft text-destructive", bar: "bg-destructive" },
  under_budget: { badge: "bg-warning-soft text-warning", bar: "bg-warning" },
  no_data: { badge: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/40" },
};

/** Staplarnas färger i en grupp (rad 1, 2, 3 …); nått mål blir grönt. */
const ROW_BARS = ["bg-primary", "bg-[var(--chart-2)]", "bg-[var(--chart-4)]", "bg-[var(--chart-5)]"];

const fmtDay = { sv: new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", timeZone: "UTC" }), en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) };
const day = (s: string, lang: "sv" | "en") => fmtDay[lang].format(new Date(`${s}T00:00:00Z`));

/**
 * Kundens mål. Mål med samma grupp (t.ex. "Demoprodukt SE") visas som ett kort med en rad per
 * nyckeltal: utfall / mål, en stapel och en bock när målet är nått. Övriga mål visas med
 * status, prognos och budgettakt.
 */
export function GoalWidget({ data, print }: WidgetViewProps) {
  const lang = useLang();
  const [page, setPage] = useState(0);
  const goals = data?.goals ?? [];
  if (!goals.length) return <p className="text-sm text-muted-foreground">{lang === "en" ? "No goals to show." : "Inga mål att visa."}</p>;
  const groups = [...new Set(goals.filter((g) => g.group).map((g) => g.group!))];
  const single = goals.filter((g) => !g.group);
  const named = groups.length > 1 || single.length > 0;
  // En sida per grupp (kampanj/marknad) och övriga mål tre åt gången. Utskrift visar allt.
  const pages: React.ReactNode[] = [
    ...groups.map((name) => <GoalGroup key={name} name={named ? name : null} goals={goals.filter((g) => g.group === name)} />),
    ...chunk(single, 3).map((list) => (
      <ul key={list[0]!.id} className="space-y-4">
        {list.map((g) => (
          <SingleGoal key={g.id} g={g} />
        ))}
      </ul>
    )),
  ];
  if (print || pages.length === 1) return <div className="space-y-5">{pages}</div>;
  const current = Math.min(page, pages.length - 1);
  const label = lang === "en" ? `Page ${current + 1} of ${pages.length}` : `Sida ${current + 1} av ${pages.length}`;
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1" aria-live="polite">
        {pages[current]}
      </div>
      <nav className="mt-3 flex items-center justify-end gap-1" aria-label={lang === "en" ? "Goal pages" : "Målsidor"}>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          onClick={() => setPage(current - 1)}
          disabled={current === 0}
          aria-label={lang === "en" ? "Previous" : "Föregående"}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="tabular text-xs text-muted-foreground">
          <span className="sr-only">{label}</span>
          <span aria-hidden>
            {current + 1} / {pages.length}
          </span>
        </span>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          onClick={() => setPage(current + 1)}
          disabled={current === pages.length - 1}
          aria-label={lang === "en" ? "Next" : "Nästa"}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </nav>
    </div>
  );
}

const chunk = <T,>(list: T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

function GoalGroup({ name, goals }: { name: string | null; goals: GoalProgress[] }) {
  const lang = useLang();
  const tt = useT();
  const w = goals[0]!.window;
  return (
    <section aria-label={name ?? undefined}>
      {name && <h4 className="mb-2 text-sm font-bold text-heading">{name}</h4>}
      <ul className="space-y-3">
        {goals.map((g, i) => {
          const fmt = (v: number | null) => formatMetric(g.meta, v, g.currency ?? undefined, lang);
          const share = g.actual !== null && g.target ? g.actual / g.target : 0;
          return (
            <li key={g.id}>
              <div className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-heading">{g.label}</span>
                <span className="tabular whitespace-nowrap text-heading">
                  {fmt(g.actual)} / {fmt(g.target)}
                </span>
                {g.reached ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-label={lang === "en" ? "Target reached" : "Målet nått"} />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border-2 border-muted" aria-hidden />
                )}
              </div>
              <div
                className="mt-1.5 h-2 rounded-full bg-muted"
                role="img"
                aria-label={lang === "en" ? `${Math.round(share * 100)}% of target` : `${Math.round(share * 100)} % av målet`}
              >
                <div className={cn("h-full rounded-full", g.reached ? "bg-success" : ROW_BARS[i % ROW_BARS.length])} style={{ width: `${Math.min(100, share * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="tabular mt-2 text-xs text-muted-foreground">
        {goals[0]!.period === "custom" ? tt("custom") : tt(goals[0]!.period)} · {day(w.start, lang)}–{day(w.end, lang)}
      </p>
    </section>
  );
}

function SingleGoal({ g }: { g: GoalProgress }) {
  const lang = useLang();
  const tt = useT();
  const e = g.evaluation;
  const fmt = (v: number | null) => formatMetric(g.meta, v, g.currency ?? undefined, lang);
  const tone = TONE[e.status];
  const period = tt(g.period);
  const budget = g.metric === "spend";
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium">
          {g.label} <span className="font-normal text-muted-foreground">{g.period === "custom" ? `· ${period}` : `· ${budget ? tt("budgetPer") : tt("goalPer")} ${period}`}</span>
        </p>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone.badge)}>{tt(e.status)}</span>
      </div>
      <p className="mt-1 text-sm">
        <span className="tabular text-lg font-bold text-heading">{fmt(g.actual)}</span>
        <span className="text-muted-foreground">
          {" "}
          {tt("goalOf")} {fmt(g.target)}
        </span>
      </p>
      {e.progress !== null && (
        <div
          className="relative mt-2 h-2 rounded-full bg-muted"
          role="img"
          aria-label={lang === "en" ? `${Math.round(e.progress * 100)}% of target, ${Math.round(e.elapsedShare * 100)}% of the period has passed` : `${Math.round(e.progress * 100)} % av målet, ${Math.round(e.elapsedShare * 100)} % av perioden har gått`}
        >
          <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.min(100, e.progress * 100)}%` }} />
          {/* Var utfallet borde ligga i dag för att nå målet / förbruka budgeten i takt */}
          <span className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/70" style={{ left: `${e.elapsedShare * 100}%` }} aria-hidden />
        </div>
      )}
      <p className="tabular mt-1.5 text-xs text-muted-foreground">
        {e.projection !== null
          ? `${tt("goalForecast")} ${fmt(e.projection)} · ${tt("goalShouldBe")} ${fmt(e.expectedSoFar)} ${tt("goalToday")}`
          : `${g.meta.higherIsBetter === false ? tt("goalAtMost") : tt("goalAtLeast")} ${fmt(g.target)}`}
        {" · "}
        {day(g.window.start, lang)}–{day(g.window.through, lang)}
      </p>
    </li>
  );
}
