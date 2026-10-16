"use client";

import { useLang, useT } from "@/components/lang-context";
import { formatMetric, type MetricMeta } from "@rp/core";
import { metaOf, shortLabel } from "./meta";
import { ExternalLink, Eye, Images, Loader2, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { WidgetViewProps } from "./types";

/** Annonsgalleri. Texten trunkeras bara avsiktligt (fäll ut), i PDF visas den alltid hel. */
export function AdGalleryWidget({ data, config, print = false }: WidgetViewProps) {
  const tt = useT();
  const lang = useLang();
  // Annonsdata finns bara när förhandsvisningen hunnit hämta galleridata.
  const ads = useMemo(() => data?.ads ?? [], [data?.ads]);
  const metrics = config.metrics.map((m) => metaOf(data, m));
  // Läsaren kan sortera om galleriet; standard är widgetens sortering (från servern).
  const [sortBy, setSortBy] = useState<string>("");
  const sorted = useMemo(() => {
    if (!sortBy) return ads;
    const [by, dir] = sortBy.split(":");
    return [...ads].sort((a, b) => ((a.values[by!] ?? -Infinity) - (b.values[by!] ?? -Infinity)) * (dir === "asc" ? 1 : -1));
  }, [ads, sortBy]);
  if (ads.length === 0) return <p className="text-sm text-muted-foreground">{tt("noAds")}</p>;
  const L = lang === "en" ? { sort: "Sort", default: "As in the report", high: "highest first", low: "lowest first" } : { sort: "Sortera", default: "Som i rapporten", high: "högst först", low: "lägst först" };
  return (
    <div className="space-y-3">
      {!print && metrics.length > 0 && ads.length > 1 && (
        <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
          {L.sort}
          <select
            className="h-7 rounded-md border bg-background px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="">{L.default}</option>
            {metrics.flatMap((m) => [
              <option key={`${m.id}:desc`} value={`${m.id}:desc`}>
                {m.label}, {L.high}
              </option>,
              <option key={`${m.id}:asc`} value={`${m.id}:asc`}>
                {m.label}, {L.low}
              </option>,
            ])}
          </select>
        </label>
      )}
      {/* I utskrift används flex-wrap: Chrome delar flex-rader över sidor utan att kort överlappar. */}
      <ul className={print ? "flex flex-wrap gap-4" : "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]"}>
        {sorted.map((ad) => (
          <AdCard key={ad.key} ad={ad} metrics={metrics} currency={data?.currency ?? undefined} expandedByDefault={print} print={print} />
        ))}
      </ul>
    </div>
  );
}

function AdCard({
  ad,
  metrics,
  currency,
  expandedByDefault,
  print,
}: {
  ad: NonNullable<WidgetViewProps["data"]>["ads"] extends (infer T)[] | undefined ? T : never;
  metrics: MetricMeta[];
  currency?: string;
  expandedByDefault: boolean;
  print: boolean;
}) {
  const lang = useLang(); const tt = useT();
  const [open, setOpen] = useState(expandedByDefault);
  const long = (ad.text?.length ?? 0) > 140;
  return (
    <li
      className="flex flex-col overflow-hidden rounded-lg border bg-background/40"
      style={print ? { width: "calc((100% - 3rem) / 4)", breakInside: "avoid" } : undefined}
    >
      <div className="relative aspect-square bg-muted">
        {ad.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.thumbnailUrl} alt={ad.headline ?? ad.name} className="h-full w-full object-cover" loading={print ? "eager" : "lazy"} />
        )}
        {ad.playUrl && !print && (ad.format === "video" || !ad.thumbnailUrl) ? (
          <MediaPlayer ad={ad} preview={ad.format !== "video"} />
        ) : ad.format === "video" ? (
          <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white">
            <Play className="size-3.5" aria-label="Video" />
          </span>
        ) : ad.format === "carousel" ? (
          <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-black/60 text-white">
            <Images className="size-3.5" aria-label="Karusell" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {ad.headline && <p className="text-sm font-medium">{ad.headline}</p>}
        {ad.text && (
          <div className="text-xs leading-relaxed text-muted-foreground">
            <p className={open || !long ? undefined : "line-clamp-3"}>{ad.text}</p>
            {long && !expandedByDefault && (
              <button className="mt-1 font-medium text-foreground underline-offset-2 hover:underline print:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                {open ? tt("showLess") : tt("showFullText")}
              </button>
            )}
          </div>
        )}
        {ad.permalink && !print && (
          <a href={ad.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-link underline-offset-2 hover:underline">
            {tt("viewPost")} <ExternalLink className="size-3" />
          </a>
        )}
        <dl className="mt-auto grid grid-cols-2 gap-2 border-t pt-2">
          {metrics.map((m) => (
            <div key={m.id}>
              <dt className="text-[11px] text-muted-foreground">{shortLabel(m)}</dt>
              <dd className="tabular text-sm font-semibold">{formatMetric(m, ad.values[m.id] ?? null, currency, lang)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </li>
  );
}

type Ad = NonNullable<NonNullable<WidgetViewProps["data"]>["ads"]>[number];
type Media = { kind: "video"; url: string; poster?: string } | { kind: "iframe"; url: string; width: number; height: number };

/**
 * Play-knapp över bilden, eller "Visa annonsen" när bilden saknas. Länken hämtas först
 * vid klick (plattformarnas länkar är kortlivade).
 */
function MediaPlayer({ ad, preview }: { ad: Ad; preview: boolean }) {
  const tt = useT();
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<Media | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setOpen(true);
    setError(null);
    setMedia(null);
    try {
      const res = await fetch(ad.playUrl!);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kunde inte visa annonsen.");
      setMedia(body as Media);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spela upp videon.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="group absolute inset-0 grid place-items-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={preview ? `${tt("viewAd")} ${ad.name}` : `${tt("playVideo")} ${ad.name}`}
      >
        {preview ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow-soft transition-transform group-hover:scale-105">
            <Eye className="size-3.5" /> {tt("viewAd")}
          </span>
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110">
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-fit max-w-[calc(100vw-2rem)] gap-3 p-4 sm:max-w-fit">
          <DialogTitle className="pr-8 text-base">{ad.headline ?? ad.name}</DialogTitle>
          <DialogDescription className="sr-only">{preview ? "Förhandsvisning av annonsen" : "Videoannons"}</DialogDescription>
          <div className="grid min-h-60 min-w-72 place-items-center overflow-hidden rounded-lg bg-black">
            {error ? (
              <p className="p-6 text-sm text-white/80">{error}</p>
            ) : !media ? (
              <Loader2 className="size-6 animate-spin text-white/70" aria-label={preview ? "Hämtar annonsen" : "Hämtar videon"} />
            ) : media.kind === "video" ? (
              <video src={media.url} poster={media.poster} controls autoPlay playsInline className="max-h-[75vh] max-w-full" />
            ) : (
              <iframe
                src={media.url}
                title={`Förhandsvisning av ${ad.name}`}
                width={media.width}
                height={media.height}
                allow="autoplay; encrypted-media"
                referrerPolicy="no-referrer"
                className="max-h-[75vh] max-w-full bg-white"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
