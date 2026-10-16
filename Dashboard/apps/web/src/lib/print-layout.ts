/**
 * Gör om dashboardens grid till "band" för utskrift: widgets vars rader
 * överlappar hamnar i samma band. Ett band bryts aldrig mellan sidor (om det
 * får plats), och inom bandet behåller widgets sin placering i 12 kolumner.
 */
import type { WidgetLayout } from "@rp/core";

export interface BandItem<T> {
  item: T;
  col: number;
  span: number;
  row: number;
  rowSpan: number;
}

export interface Band<T> {
  rows: number;
  items: BandItem<T>[];
}

export function toBands<T extends { layout: WidgetLayout }>(widgets: T[]): Band<T>[] {
  const sorted = [...widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
  const bands: { top: number; bottom: number; items: T[] }[] = [];
  for (const w of sorted) {
    const top = w.layout.y;
    const bottom = w.layout.y + w.layout.h;
    const last = bands[bands.length - 1];
    if (last && top < last.bottom) {
      last.items.push(w);
      last.bottom = Math.max(last.bottom, bottom);
    } else {
      bands.push({ top, bottom, items: [w] });
    }
  }
  return bands.map((b) => ({
    rows: b.bottom - b.top,
    items: b.items.map((w) => ({ item: w, col: w.layout.x + 1, span: w.layout.w, row: w.layout.y - b.top + 1, rowSpan: w.layout.h })),
  }));
}
