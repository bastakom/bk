import { DIMENSIONS, dimensionText, METRICS, metricText, type Lang, type WidgetConfig, type WidgetType } from "@rp/core";

/** Automatisk rubrik när användaren inte satt någon. */
export function autoTitle(type: WidgetType, config: WidgetConfig, labelOf: (id: string) => string | undefined = () => undefined, lang: Lang = "sv"): string {
  const en = lang === "en";
  const m = config.metrics.map((x) => labelOf(x) ?? metricText(x, METRICS[x as keyof typeof METRICS] ?? { label: x }, lang).label);
  switch (type) {
    case "kpi":
      return config.metrics.length === 1 ? (metricText(config.metrics[0]!, METRICS[config.metrics[0]! as keyof typeof METRICS] ?? { label: m[0]! }, lang).shortLabel ?? m[0]!) : en ? "Key metrics" : "Nyckeltal";
    case "metric_list":
      return config.listMode === "sources" && m[0] ? m[0] : en ? "Key metrics" : "Nyckeltal";
    case "timeseries":
      return m.join(en ? " and " : " och ") || "Trend";
    case "bar":
    case "donut":
    case "table":
      return config.dimension ? `${dimensionText(config.dimension, DIMENSIONS[config.dimension].label, lang)}${m[0] ? ` · ${m[0]}` : ""}` : en ? "Distribution" : "Fördelning";
    case "funnel":
      return en ? "Video funnel" : "Videofunnel";
    case "ad_gallery":
      return en ? "Ads" : "Annonser";
    case "goal":
      return en ? "Goals and budget" : "Mål och budget";
    case "summary":
      return en ? "Summary" : "Sammanfattning";
    case "media":
      return "";
    case "map":
      return `${config.dimension === "region" ? (en ? "Regions" : "Regioner") : en ? "Countries" : "Länder"}${m[0] ? ` · ${m[0]}` : ""}`;
    case "text":
      return "";
    case "section":
      return "";
  }
}
