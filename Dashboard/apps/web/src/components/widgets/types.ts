import type { PlatformId, WidgetConfig, WidgetType } from "@rp/core";
import type { WidgetData } from "@/lib/dashboard-data";
import type { ChartMode } from "./chart-theme";

export interface WidgetViewProps {
  type: WidgetType;
  title: string | null;
  config: WidgetConfig;
  data: WidgetData | null;
  /** Plattformarna bakom widgetens källor (styr färg). */
  platforms: PlatformId[];
  /** Tvinga ljust läge (PDF). */
  mode?: ChartMode;
  /** Visa tabell i stället för diagram (tillgänglighet). */
  asTable?: boolean;
  /** Utskrift/PDF: inga interaktiva element, all text visas hel. */
  print?: boolean;
  /** Rubriken som visas (egen eller automatisk); KPI-kort med ikon visar den bredvid ikonen. */
  displayTitle?: string;
  /** Framhävt KPI-block (mörk bakgrund i kundens färg). */
  emphasis?: boolean;
}
