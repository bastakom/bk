import type { DateRange } from "./types";

const DAY = 86_400_000;

export const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => fmtDate(new Date(toDate(s).getTime() + n * DAY));

export function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) out.push(d);
  return out;
}

export const daysInRange = (r: DateRange) => Math.round((toDate(r.end).getTime() - toDate(r.start).getTime()) / DAY) + 1;

/** "Idag" i en given tidszon som YYYY-MM-DD. */
export function todayInTimezone(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Delar en lång period i bitar (många API:er begränsar dagliga rapporter per anrop). */
export function chunkRange(range: DateRange, days = 90): DateRange[] {
  const out: DateRange[] = [];
  for (let start = range.start; start <= range.end; start = addDays(start, days)) {
    const end = addDays(start, days - 1);
    out.push({ start, end: end < range.end ? end : range.end });
  }
  return out;
}
