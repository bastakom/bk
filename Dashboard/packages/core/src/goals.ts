/**
 * Kundmål: utfall mot mål för innevarande period (månad/kvartal/år), med prognos.
 *
 *  - Volymmål (t.ex. leads, besök): prognos = utfall hittills / förflutna dagar × periodens dagar.
 *  - Budget (spend): "i takt" om prognosen ligger inom ±10 % av budgeten.
 *  - Kvoter (t.ex. CPA, ROAS, CTR): utfallet hittills jämförs direkt med målet,
 *    åt rätt håll (lägre CPA är bättre, högre ROAS är bättre).
 */
import { z } from "zod";
import { dataFilterSchema } from "./filters";

export const GOAL_PERIODS = [
  { id: "month", label: "per månad" },
  { id: "quarter", label: "per kvartal" },
  { id: "year", label: "per år" },
  { id: "custom", label: "egen period (kampanj)" },
] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number]["id"];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ange datum som ÅÅÅÅ-MM-DD");

export const goalInputSchema = z
  .object({
    label: z.string().trim().max(80).optional().transform((v) => v || undefined),
    metric: z.string().min(1),
    target: z.number().positive("Målvärdet måste vara större än 0").max(1e12),
    period: z.enum(["month", "quarter", "year", "custom"]),
    /** Egen kampanjperiod (period = custom) */
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    /** Mål med samma grupp visas tillsammans, t.ex. "Demoprodukt SE" */
    group: z.string().trim().max(60).optional().transform((v) => v || undefined),
    /** Datafilter, t.ex. bara kampanjer som innehåller "SE" */
    filters: z.array(dataFilterSchema).max(10).default([]),
    /** Tom = alla kundens källor som har metricen */
    accountIds: z.array(z.string()).max(30).default([]),
  })
  .refine((g) => g.period !== "custom" || (g.startDate && g.endDate && g.startDate <= g.endDate), { message: "Ange kampanjens start- och slutdatum (start före slut)", path: ["endDate"] });
export type GoalInput = z.infer<typeof goalInputSchema>;

export type GoalStatus = "on_track" | "close" | "behind" | "over_budget" | "under_budget" | "no_data";

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  on_track: "I fas",
  close: "Nära",
  behind: "Efter",
  over_budget: "Överförbrukning",
  under_budget: "Underförbrukning",
  no_data: "Ingen data",
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Kalenderperioden som innehåller datumet (YYYY-MM-DD), eller målets egen period. */
export function goalWindow(period: GoalPeriod, date: string, custom?: { start: string; end: string }): { start: string; end: string } {
  if (period === "custom") return custom ?? { start: date, end: date };
  const [y, m] = date.split("-").map(Number) as [number, number];
  if (period === "month") return { start: iso(y, m, 1), end: iso(y, m, daysInMonth(y, m)) };
  if (period === "quarter") {
    const q0 = Math.floor((m - 1) / 3) * 3 + 1;
    return { start: iso(y, q0, 1), end: iso(y, q0 + 2, daysInMonth(y, q0 + 2)) };
  }
  return { start: iso(y, 1, 1), end: iso(y, 12, 31) };
}

export const daysBetween = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;

export interface GoalEvaluation {
  status: GoalStatus;
  /** Andel av perioden som gått (0–1) */
  elapsedShare: number;
  /** Utfall / mål (volymmål och budget) */
  progress: number | null;
  /** Prognos för hela perioden (volymmål och budget) */
  projection: number | null;
  /** Var utfallet borde ligga i dag om målet ska nås (volymmål och budget) */
  expectedSoFar: number | null;
}

export function evaluateGoal(p: {
  /** Summerbar metric (volym, spend) eller kvot */
  additive: boolean;
  /** Spend: budget som ska förbrukas i takt */
  budget: boolean;
  /** Högre är bättre? (null = neutral, behandlas som högre) */
  higherIsBetter: boolean | null;
  target: number;
  actual: number | null;
  elapsedDays: number;
  totalDays: number;
}): GoalEvaluation {
  const elapsedShare = Math.min(1, Math.max(0, p.elapsedDays / p.totalDays));
  if (p.actual === null || p.elapsedDays <= 0) return { status: "no_data", elapsedShare, progress: null, projection: null, expectedSoFar: null };

  if (p.additive) {
    const projection = (p.actual / p.elapsedDays) * p.totalDays;
    const ratio = projection / p.target;
    const base = { elapsedShare, progress: p.actual / p.target, projection, expectedSoFar: p.target * elapsedShare };
    if (p.budget) return { ...base, status: ratio > 1.1 ? "over_budget" : ratio < 0.9 ? "under_budget" : "on_track" };
    if (p.higherIsBetter === false) return { ...base, status: ratio <= 1 ? "on_track" : ratio <= 1.1 ? "close" : "behind" };
    return { ...base, status: ratio >= 1 ? "on_track" : ratio >= 0.9 ? "close" : "behind" };
  }

  const lowerIsBetter = p.higherIsBetter === false;
  const ratio = p.actual / p.target;
  const status: GoalStatus = lowerIsBetter ? (ratio <= 1 ? "on_track" : ratio <= 1.1 ? "close" : "behind") : ratio >= 1 ? "on_track" : ratio >= 0.9 ? "close" : "behind";
  return { status, elapsedShare, progress: null, projection: null, expectedSoFar: null };
}
