import type { Granularity } from "@rp/core";

const formats = (locale: string) => ({
  day: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }),
  month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }),
  monthYear: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }),
  full: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
});
const F = { sv: formats("sv-SE"), en: formats("en-GB") };

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

/** Kort etikett på x-axeln. */
export function axisLabel(key: string, g: Granularity, lang: "sv" | "en" = "sv"): string {
  const d = new Date(`${key}T00:00:00Z`);
  if (g === "month") return F[lang].month.format(d).replace(".", "");
  if (g === "week") return `${lang === "en" ? "w." : "v."} ${isoWeek(d)}`;
  return F[lang].day.format(d).replace(".", "");
}

/** Längre etikett i tooltip. */
export function tooltipLabel(key: string, g: Granularity, lang: "sv" | "en" = "sv"): string {
  if (!key) return "";
  const d = new Date(`${key}T00:00:00Z`);
  if (g === "month") return F[lang].monthYear.format(d);
  if (g === "week") return `${lang === "en" ? "Week" : "Vecka"} ${isoWeek(d)}, ${d.getUTCFullYear()}`;
  return F[lang].full.format(d);
}
