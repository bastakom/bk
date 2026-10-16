import { PLATFORMS, type PlatformId } from "@rp/core";
import { forWhiteText } from "@/lib/brand";
import { cn } from "@/lib/utils";

const MONOGRAM: Record<PlatformId, string> = {
  ga4: "GA",
  google_ads: "Ads",
  meta_ads: "M",
  linkedin_ads: "in",
  tiktok_ads: "TT",
};

/** Neutral monogram i källans accentfärg (samma färg som i graferna). */
export function PlatformIcon({ platform, size = "md", className }: { platform: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const meta = PLATFORMS[platform as PlatformId];
  if (!meta) return null;
  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      role="img"
      style={{ ["--pc" as string]: forWhiteText(meta.color), ["--pc-dark" as string]: meta.colorDark }}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-md bg-[var(--pc)] font-semibold tracking-tight text-white dark:bg-[var(--pc-dark)] dark:text-[#111]",
        size === "sm" && "size-5 text-[9px]",
        size === "md" && "size-7 text-[11px]",
        size === "lg" && "size-10 text-sm",
        className,
      )}
    >
      {MONOGRAM[meta.id]}
    </span>
  );
}

/** YouTube (Google Ads-kampanjer av typen video) när den visas som egen källa. */
export function YouTubeIcon({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      title="YouTube"
      aria-label="YouTube"
      role="img"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-md bg-[#c4302b] font-semibold tracking-tight text-white",
        size === "sm" && "size-5 text-[9px]",
        size === "md" && "size-7 text-[11px]",
        size === "lg" && "size-10 text-sm",
        className,
      )}
    >
      YT
    </span>
  );
}
