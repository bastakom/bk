"use client";

import { CATEGORICAL, CHART_NEUTRALS, PLATFORMS, type PlatformId } from "@rp/core";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

export type ChartMode = "light" | "dark";

const subscribe = () => () => {};

/** Ljust/mörkt för diagram. Före hydrering (och i PDF) används ljust. */
export function useChartMode(forced?: ChartMode): ChartMode {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (forced) return forced;
  return mounted && resolvedTheme === "dark" ? "dark" : "light";
}

export function chartColors(mode: ChartMode) {
  return { ...CHART_NEUTRALS[mode], categorical: CATEGORICAL[mode] };
}

export function platformColor(platform: PlatformId | undefined, mode: ChartMode, fallback: string) {
  if (!platform) return fallback;
  const p = PLATFORMS[platform];
  return mode === "dark" ? p.colorDark : p.color;
}
