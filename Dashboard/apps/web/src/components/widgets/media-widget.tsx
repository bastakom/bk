"use client";

import { videoEmbed } from "@rp/core";
import { Play } from "lucide-react";
import type { WidgetViewProps } from "./types";

/** Uppladdad bild eller inbäddad YouTube-/Vimeo-video. Bara egna bilder (data-URL) och kända videotjänster visas. */
export function MediaWidget({ config, title, print }: WidgetViewProps) {
  const caption = config.caption?.trim();
  if (config.mediaKind === "video") {
    const v = config.mediaUrl ? videoEmbed(config.mediaUrl) : null;
    if (!v) return <p className="text-sm text-muted-foreground">Ingen video vald.</p>;
    return (
      <figure className="flex h-full flex-col gap-2">
        {print ? (
          // I PDF: omslagsbild (YouTube) eller länk – video kan inte spelas på papper.
          <a href={config.mediaUrl} className="relative block overflow-hidden rounded-lg bg-black">
            {v.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbnail} alt={caption ?? title ?? "Video"} className="aspect-video w-full object-cover opacity-90" loading="eager" />
            ) : (
              <span className="flex aspect-video items-center justify-center text-sm text-white/80">Video: {config.mediaUrl}</span>
            )}
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-black/60 text-white">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </span>
          </a>
        ) : (
          <iframe
            src={v.embed}
            title={caption ?? title ?? "Video"}
            className="min-h-0 w-full flex-1 rounded-lg bg-black"
            style={{ aspectRatio: "16 / 9" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        )}
        {caption && <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>}
      </figure>
    );
  }
  if (!config.mediaUrl?.startsWith("data:image/")) return <p className="text-sm text-muted-foreground">Ingen bild vald.</p>;
  return (
    <figure className="flex h-full flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={config.mediaUrl} alt={caption ?? title ?? ""} className="min-h-0 w-full flex-1 rounded-lg object-contain" loading={print ? "eager" : "lazy"} />
      {caption && <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
