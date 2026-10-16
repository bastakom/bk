"use client";

import { AdGalleryWidget } from "./ad-gallery-widget";
import { BarWidget } from "./bar-widget";
import { DonutWidget } from "./donut-widget";
import { FunnelWidget } from "./funnel-widget";
import { GoalWidget } from "./goal-widget";
import { MapWidget } from "./map-widget";
import { MediaWidget } from "./media-widget";
import { SummaryWidget } from "./summary-widget";
import { KpiWidget } from "./kpi-widget";
import { MetricListWidget } from "./metric-list-widget";
import { SectionWidget } from "./section-widget";
import { TableWidget } from "./table-widget";
import { TextWidget } from "./text-widget";
import { TimeseriesWidget } from "./timeseries-widget";
import type { WidgetViewProps } from "./types";

const VIEWS = {
  kpi: KpiWidget,
  metric_list: MetricListWidget,
  timeseries: TimeseriesWidget,
  bar: BarWidget,
  donut: DonutWidget,
  table: TableWidget,
  funnel: FunnelWidget,
  ad_gallery: AdGalleryWidget,
  goal: GoalWidget,
  summary: SummaryWidget,
  media: MediaWidget,
  map: MapWidget,
  text: TextWidget,
  section: SectionWidget,
} as const;

export function WidgetView(props: WidgetViewProps) {
  const View = VIEWS[props.type];
  return <View {...props} />;
}
