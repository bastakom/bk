/**
 * Datumperioder och jämförelseperioder. Allt räknas i kundens tidszon:
 * "idag" bestäms av anroparen (todayInTimezone) och skickas in.
 */
import { addDays, daysInRange, fmtDate, toDate } from "./dates";
import type { DateRange } from "./types";

export type RangePreset =
  | "last_week"
  | "last_7"
  | "last_30"
  | "last_90"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "custom";

export type CompareMode = "previous_period" | "previous_year" | "none";

export const RANGE_PRESETS: { id: Exclude<RangePreset, "custom">; label: string }[] = [
  { id: "last_week", label: "Förra veckan" },
  { id: "last_7", label: "Senaste 7 dagarna" },
  { id: "last_30", label: "Senaste 30 dagarna" },
  { id: "last_90", label: "Senaste 90 dagarna" },
  { id: "this_month", label: "Denna månad" },
  { id: "last_month", label: "Förra månaden" },
  { id: "this_quarter", label: "Detta kvartal" },
  { id: "last_quarter", label: "Förra kvartalet" },
  { id: "this_year", label: "I år" },
  { id: "last_year", label: "Förra året" },
];

export const COMPARE_MODES: { id: CompareMode; label: string }[] = [
  { id: "previous_period", label: "Mot föregående period" },
  { id: "previous_year", label: "Mot samma period i fjol" },
  { id: "none", label: "Ingen jämförelse" },
];

const ymd = (y: number, m: number, d: number) => fmtDate(new Date(Date.UTC(y, m, d)));
const endOfMonth = (y: number, m: number) => ymd(y, m + 1, 0);

/**
 * Senaste N dagarna räknas till och med igår, eftersom dagens data är ofullständig.
 * Kalenderperioder (månad, kvartal, år) som pågår slutar idag.
 */
export function resolvePreset(preset: Exclude<RangePreset, "custom">, today: string): DateRange {
  const t = toDate(today);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const yesterday = addDays(today, -1);
  const q = Math.floor(m / 3);
  switch (preset) {
    case "last_week": {
      // Hel ISO-vecka (måndag–söndag) före den pågående.
      const dow = (t.getUTCDay() + 6) % 7;
      const monday = addDays(today, -dow - 7);
      return { start: monday, end: addDays(monday, 6) };
    }
    case "last_7":
      return { start: addDays(yesterday, -6), end: yesterday };
    case "last_30":
      return { start: addDays(yesterday, -29), end: yesterday };
    case "last_90":
      return { start: addDays(yesterday, -89), end: yesterday };
    case "this_month":
      return { start: ymd(y, m, 1), end: today };
    case "last_month":
      return { start: ymd(y, m - 1, 1), end: endOfMonth(y, m - 1) };
    case "this_quarter":
      return { start: ymd(y, q * 3, 1), end: today };
    case "last_quarter":
      return { start: ymd(y, q * 3 - 3, 1), end: endOfMonth(y, q * 3 - 1) };
    case "this_year":
      return { start: ymd(y, 0, 1), end: today };
    case "last_year":
      return { start: ymd(y - 1, 0, 1), end: ymd(y - 1, 11, 31) };
  }
}

/** Flyttar ett datum n månader. Månadsslut förblir månadsslut (31 mar → 28/29 feb). */
function shiftMonths(s: string, n: number): string {
  const d = toDate(s);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const isMonthEnd = s === endOfMonth(y, m);
  const lastDay = new Date(Date.UTC(y, m + n + 1, 0)).getUTCDate();
  return ymd(y, m + n, isMonthEnd ? lastDay : Math.min(d.getUTCDate(), lastDay));
}

const CALENDAR_DAYS: Partial<Record<RangePreset, number>> = { last_week: 7 };

const CALENDAR_MONTHS: Partial<Record<RangePreset, number>> = {
  this_month: 1,
  last_month: 1,
  this_quarter: 3,
  last_quarter: 3,
  this_year: 12,
  last_year: 12,
};

/**
 * Jämförelseperiod. Kalenderperioder (månad, kvartal, år) jämförs med
 * föregående kalenderperiod, så att "förra året" jämförs med hela året innan.
 * Övriga perioder jämförs med lika många dagar direkt innan.
 */
export function compareRange(range: DateRange, mode: CompareMode, preset?: RangePreset): DateRange | null {
  if (mode === "none") return null;
  if (mode === "previous_year") return { start: shiftMonths(range.start, -12), end: shiftMonths(range.end, -12) };
  const days = preset ? CALENDAR_DAYS[preset] : undefined;
  if (days) return { start: addDays(range.start, -days), end: addDays(range.end, -days) };
  const months = preset ? CALENDAR_MONTHS[preset] : undefined;
  if (months) return { start: shiftMonths(range.start, -months), end: shiftMonths(range.end, -months) };
  const n = daysInRange(range);
  return { start: addDays(range.start, -n), end: addDays(range.start, -1) };
}

const dateFormats = (lang: "sv" | "en") => ({
  dayMonth: new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "sv-SE", { day: "numeric", month: "short", timeZone: "UTC" }),
  dayMonthYear: new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "sv-SE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
});
const FORMATS = { sv: dateFormats("sv"), en: dateFormats("en") };

export function formatRange(r: DateRange, lang: "sv" | "en" = "sv"): string {
  const { dayMonth, dayMonthYear } = FORMATS[lang];
  const a = toDate(r.start);
  const b = toDate(r.end);
  if (r.start === r.end) return dayMonthYear.format(a);
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  return `${(sameYear ? dayMonth : dayMonthYear).format(a)} – ${dayMonthYear.format(b)}`;
}

export type Granularity = "day" | "week" | "month";

/** Automatisk upplösning så att en årsgraf inte blir 365 punkter brus. */
export function autoGranularity(range: DateRange): Granularity {
  const n = daysInRange(range);
  if (n <= 45) return "day";
  if (n <= 190) return "week";
  return "month";
}

/** Nyckel för den bucket ett datum hamnar i (ISO-vecka börjar måndag). */
export function bucketKey(date: string, g: Granularity): string {
  if (g === "day") return date;
  if (g === "month") return `${date.slice(0, 7)}-01`;
  const d = toDate(date);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}
