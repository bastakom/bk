/**
 * Schemaläggning av rapportutskick: nästa körning räknas i kundens tidszon
 * (t.ex. "måndagar 07:00 Europe/Stockholm") och returneras som UTC.
 */

export type ScheduleFrequency = "WEEKLY" | "MONTHLY";

export interface ScheduleRule {
  frequency: ScheduleFrequency;
  /** 1 = måndag … 7 = söndag (veckovis) */
  weekday?: number | null;
  /** 1–28, eller 0 = sista dagen i månaden (månadsvis) */
  dayOfMonth?: number | null;
  /** Timme 0–23 i `timezone` */
  hour: number;
  timezone: string;
}

/** Tidszonens förskjutning mot UTC i minuter vid en viss tidpunkt. */
function offsetMinutes(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Lokal väggklocka i `timezone` → UTC-tidpunkt (hanterar sommartid). */
export function zonedToUtc(y: number, m: number, d: number, hour: number, timezone: string): Date {
  const guess = Date.UTC(y, m, d, hour);
  const off1 = offsetMinutes(timezone, new Date(guess));
  const candidate = guess - off1 * 60_000;
  const off2 = offsetMinutes(timezone, new Date(candidate));
  return new Date(guess - off2 * 60_000);
}

/** Lokalt datum (år, månad 0–11, dag, veckodag 1–7) i `timezone`. */
function localDate(at: Date, timezone: string) {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m: m - 1, d, weekday: dow === 0 ? 7 : dow };
}

/** Nästa körning strikt efter `after`. */
export function nextRun(rule: ScheduleRule, after: Date): Date {
  const start = localDate(after, rule.timezone);
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(start.y, start.m, start.d + i));
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth();
    const d = day.getUTCDate();
    const weekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const matches =
      rule.frequency === "WEEKLY" ? weekday === (rule.weekday ?? 1) : rule.dayOfMonth === 0 ? d === lastDay : d === Math.min(rule.dayOfMonth ?? 1, lastDay);
    if (!matches) continue;
    const at = zonedToUtc(y, m, d, rule.hour, rule.timezone);
    if (at > after) return at;
  }
  throw new Error("Kunde inte beräkna nästa körning");
}

const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"];

export function describeSchedule(rule: ScheduleRule): string {
  const time = `kl. ${String(rule.hour).padStart(2, "0")}:00`;
  if (rule.frequency === "WEEKLY") return `Varje ${WEEKDAYS[(rule.weekday ?? 1) - 1]} ${time}`;
  return rule.dayOfMonth === 0 ? `Sista dagen varje månad ${time}` : `Den ${rule.dayOfMonth ?? 1}:e varje månad ${time}`;
}
