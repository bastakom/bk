import { numberLocale, type Lang } from "./i18n";
import { METRICS, type Delta } from "./metrics";
import type { MetricDefinition, MetricId } from "./types";

type FormatRef = MetricId | (Pick<MetricDefinition, "format"> & { id?: string });

export function formatMetric(ref: FormatRef, value: number | null, currency = "SEK", lang: Lang = "sv"): string {
  if (value === null || Number.isNaN(value)) return "–";
  const LOCALE = numberLocale(lang);
  const def = typeof ref === "string" ? METRICS[ref] : ref;
  const id = typeof ref === "string" ? ref : ref.id;
  switch (def.format) {
    case "currency":
      return new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency,
        maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
      }).format(value);
    case "percent":
      return new Intl.NumberFormat(LOCALE, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value);
    case "duration": {
      const s = Math.round(value);
      const h = Math.floor(s / 3600);
      const mm = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      return h > 0 ? `${h} h ${mm} min` : `${mm}:${String(ss).padStart(2, "0")} min`;
    }
    default:
      // Små icke-heltal (ROAS, egna kvoter) behöver decimaler, volymer gör det inte.
      return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: id === "roas" || (Math.abs(value) < 100 && !Number.isInteger(value)) ? 2 : 0 }).format(value);
  }
}

export function formatCompact(value: number, lang: Lang = "sv"): string {
  return new Intl.NumberFormat(numberLocale(lang), { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Etikett för delta-badgen: "Ny" när föregående var 0, "–" utan jämförelse. */
export function formatDelta(_ref: FormatRef, delta: Delta, lang: Lang = "sv"): string {
  const LOCALE = numberLocale(lang);
  const pe = lang === "en" ? "pp" : "pe";
  switch (delta.kind) {
    case "none":
      return "–";
    case "new":
      return lang === "en" ? "New" : "Ny";
    case "flat":
      return "±0 %";
    case "change": {
      if (delta.percentagePoints !== undefined) {
        const pp = delta.percentagePoints * 100;
        // Små kvoter (t.ex. 0,5 %) behöver två decimaler för att förändringen ska synas.
        const digits = Math.abs(pp) < 0.1 ? 2 : 1;
        const shown = Math.abs(pp).toLocaleString(LOCALE, { maximumFractionDigits: digits });
        return shown === "0" ? `±0 ${pe}` : `${pp > 0 ? "+" : "−"}${shown} ${pe}`;
      }
      const pct = delta.relative * 100;
      const shown = Math.abs(pct).toLocaleString(LOCALE, { maximumFractionDigits: 1 });
      return shown === "0" ? "±0 %" : `${pct > 0 ? "+" : "−"}${shown} %`;
    }
  }
}

export const formatPreviousLabel = (ref: FormatRef, delta: Delta, currency?: string, lang: Lang = "sv") =>
  delta.kind === "change" || delta.kind === "flat" ? `${lang === "en" ? "prev." : "fg."} ${formatMetric(ref, delta.previous, currency, lang)}` : undefined;
