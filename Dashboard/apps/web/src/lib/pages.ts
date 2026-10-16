import { GRID_COLS, widgetConfigSchema, widgetPageId, type DashboardPage } from "@rp/core";
import type { DashboardWidget } from "./load-dashboard";

/** Id-prefix för sidrubriker som läggs in när sidorna läggs efter varandra (PDF). */
export const PAGE_HEADING_PREFIX = "page:";

/**
 * Lägger dashboardens sidor efter varandra i en lång följd (för PDF): varje sida
 * inleds med en sektionsrubrik med sidans namn. En dashboard med en sida lämnas orörd.
 */
export function flattenPages(widgets: DashboardWidget[], pages: DashboardPage[]): DashboardWidget[] {
  if (pages.length <= 1) return widgets;
  const out: DashboardWidget[] = [];
  let offset = 0;
  for (const page of pages) {
    const onPage = widgets.filter((w) => widgetPageId(w.config, pages) === page.id);
    if (!onPage.length) continue;
    out.push({
      id: `${PAGE_HEADING_PREFIX}${page.id}`,
      type: "section",
      title: page.name,
      config: widgetConfigSchema.parse({}),
      layout: { x: 0, y: offset, w: GRID_COLS, h: 2 },
      accountIds: [],
      data: null,
      missingSource: false,
    });
    const top = Math.min(...onPage.map((w) => w.layout.y));
    const bottom = Math.max(...onPage.map((w) => w.layout.y + w.layout.h));
    for (const w of onPage) out.push({ ...w, layout: { ...w.layout, y: offset + 2 + (w.layout.y - top) } });
    offset += 2 + (bottom - top);
  }
  return out;
}
