import { PLATFORMS, type PlatformId, type WidgetConfig, type WidgetLayout, type WidgetType } from "@rp/core";

interface W {
  id: string;
  type: WidgetType;
  config: WidgetConfig;
  layout: WidgetLayout;
  /** Datawidget utan någon av kundens källor vald */
  missingSource?: boolean;
}

/**
 * Döljer widgets som saknar källa, och sektionsrubriker vars alla widgets döljs.
 * Så blir en mall med t.ex. LinkedIn inte tjugo tomma rutor för en kund utan LinkedIn.
 */
export function hideMissingSources<T extends W>(widgets: T[]): { visible: T[]; hidden: T[] } {
  const hidden = widgets.filter((w) => w.missingSource);
  if (!hidden.length) return { visible: widgets, hidden };
  const ordered = [...widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
  const drop = new Set(hidden.map((w) => w.id));
  // Sektion = rubriken och allt under den fram till nästa rubrik.
  let section: T | null = null;
  let members: T[] = [];
  const flush = () => {
    if (section && members.length > 0 && members.every((m) => drop.has(m.id))) drop.add(section.id);
  };
  for (const w of ordered) {
    if (w.type === "section") {
      flush();
      section = w;
      members = [];
    } else members.push(w);
  }
  flush();
  return { visible: widgets.filter((w) => !drop.has(w.id)), hidden };
}

/** "LinkedIn Ads (8), Google Ads (6)" för en sammanfattning av dolda widgets. */
export function missingByPlatform(hidden: W[]): { platform: PlatformId | null; label: string; count: number }[] {
  const counts = new Map<PlatformId | null, number>();
  for (const w of hidden) {
    const ps = (w.config.sourcePlatforms ?? []) as PlatformId[];
    for (const p of ps.length ? ps : [null]) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts].map(([platform, count]) => ({ platform, label: platform ? PLATFORMS[platform].label : "Utan kanal", count })).sort((a, b) => b.count - a.count);
}
