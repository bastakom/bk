"use client";

import { BarChart, LineChart, MapChart, PieChart } from "echarts/charts";
import { AxisPointerComponent, GridComponent, MarkLineComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

echarts.use([LineChart, BarChart, PieChart, MapChart, GridComponent, TooltipComponent, AxisPointerComponent, MarkLineComponent, VisualMapComponent, SVGRenderer]);

/** Registrerar en karta (GeoJSON) en gång. */
export function registerMap(name: string, geoJson: Parameters<typeof echarts.registerMap>[1]) {
  if (!echarts.getMap(name)) echarts.registerMap(name, geoJson);
}

export type EChartsOption = echarts.EChartsCoreOption;

/**
 * Tunn wrapper runt ECharts med SVG-renderaren – ger vektorskarpa diagram i
 * PDF-exporten och skalar med containern.
 */
export function EChart({ option, className, label }: { option: EChartsOption; className?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const instance = echarts.init(ref.current, null, { renderer: "svg" });
    chart.current = instance;
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} role="img" aria-label={label} className={cn("h-full min-h-0 w-full", className)} />;
}
