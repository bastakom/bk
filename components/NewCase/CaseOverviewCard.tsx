"use client";

import Image from "next/image";
import Link from "next/link";
import { storyblokEditable } from "@storyblok/react";

interface StoryblokAsset {
  filename?: string;
  alt?: string;
}

export interface CaseOverviewItem {
  [key: string]: any;
  _uid: string;
  component: string;
  media?: StoryblokAsset;
  mobile_media?: StoryblokAsset;
  alt_text?: string;
  title?: string;
  client?: string;
  _resolvedHref?: string;
  _resolvedTitle?: string;
  _resolvedTags?: string[];
}

interface CaseOverviewCardProps {
  item: CaseOverviewItem;
  ratio: "16 / 9" | "1 / 1";
}

const isVideo = (filename: string) =>
  /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(filename);

const CaseOverviewCard = ({ item, ratio }: CaseOverviewCardProps) => {
  const desktopUrl = item.media?.filename;
  const mobileUrl = item.mobile_media?.filename;
  const href = item._resolvedHref;
  const title = item.title || item._resolvedTitle;
  const tags = Array.isArray(item._resolvedTags) ? item._resolvedTags : [];
  const hoverScaleClass =
    ratio === "1 / 1"
      ? "group-hover:scale-[1.035]"
      : "group-hover:scale-[1.015]";

  if (!desktopUrl || !href) return null;

  const renderMedia = (url: string, mobile = false) => {
    if (isVideo(url)) {
      return (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className={`h-full w-full object-cover transition-transform duration-700 ease-out ${hoverScaleClass}`}
          aria-label={item.alt_text || title || undefined}
        >
          <source src={url} />
        </video>
      );
    }

    const asset = mobile ? item.mobile_media : item.media;

    return (
      <Image
        src={url}
        alt={item.alt_text || asset?.alt || title || ""}
        fill
        sizes="(max-width: 1023px) 100vw, 65vw"
        className={`object-cover transition-transform duration-700 ease-out ${hoverScaleClass}`}
      />
    );
  };

  return (
    <article {...storyblokEditable(item)} className="min-w-0">
      <Link href={href} className="group block">
        <div
          className="relative w-full overflow-hidden bg-[#EEF3F7]"
          style={{ aspectRatio: ratio }}
        >
          {mobileUrl ? (
            <>
              <div className="relative h-full w-full md:hidden">
                {renderMedia(mobileUrl, true)}
              </div>
              <div className="relative hidden h-full w-full md:block">
                {renderMedia(desktopUrl)}
              </div>
            </>
          ) : (
            renderMedia(desktopUrl)
          )}
        </div>

        {(item.client || title || tags.length > 0) && (
          <div className="mt-3 text-[#25364F]">
            {(item.client || tags.length > 0) && (
              <div className="flex min-w-0 items-baseline justify-between gap-4">
                {item.client ? (
                  <p className="min-w-0 truncate text-sm font-normal uppercase tracking-[0.06em]">
                    {item.client}
                  </p>
                ) : (
                  <span />
                )}

                {tags.length > 0 && (
                  <p className="shrink-0 whitespace-nowrap text-right text-sm font-light-sofia leading-none text-[#545454]">
                    {tags.join(" · ")}
                  </p>
                )}
              </div>
            )}

            {title && (
              <h2 className="mt-1 w-full text-2xl font-normal leading-tight lg:text-3xl">
                {title}
              </h2>
            )}
          </div>
        )}
      </Link>
    </article>
  );
};

export default CaseOverviewCard;
