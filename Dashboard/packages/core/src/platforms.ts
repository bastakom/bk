import type { PlatformId } from "./types";

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  /** Accentfärg i ljust tema – används konsekvent i alla grafer för källan. */
  color: string;
  /** Samma nyans stegad för mörk yta. */
  colorDark: string;
}

/**
 * Källfärgerna är hämtade ur den validerade kategoriska paletten (dataviz-
 * referensen) i dess fasta ordning. De tre vanligaste källorna (Google Ads,
 * GA4, LinkedIn) är slot 1–3, som klarar färgblindhetskontroll för alla par i
 * både ljust och mörkt läge. Meta och TikTok ligger på slot 7 och 5; när fler
 * än tre källor syns samtidigt bär legend och direktetiketter identiteten.
 */
export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  google_ads: { id: "google_ads", label: "Google Ads", color: "#2a78d6", colorDark: "#3987e5" },
  ga4: { id: "ga4", label: "Google Analytics 4", color: "#eb6834", colorDark: "#d95926" },
  linkedin_ads: { id: "linkedin_ads", label: "LinkedIn Ads", color: "#1baf7a", colorDark: "#199e70" },
  meta_ads: { id: "meta_ads", label: "Meta Ads", color: "#4a3aa7", colorDark: "#9085e9" },
  tiktok_ads: { id: "tiktok_ads", label: "TikTok Ads", color: "#e87ba4", colorDark: "#d55181" },
};

export const PLATFORM_IDS = Object.keys(PLATFORMS) as PlatformId[];

/** Validerad kategorisk palett i fast ordning (aldrig cyklad). Slot 9+ slås ihop till "Övrigt". */
export const CATEGORICAL = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

/** Neutrala diagramfärger (axlar, rutnät, jämförelseperiod, "Övrigt"). */
export const CHART_NEUTRALS = {
  light: { text: "#52514e", muted: "#7a7975", grid: "#e9e8e4", axis: "#d6d5d0", comparison: "#a8a7a1", other: "#c9c8c2", surface: "#ffffff" },
  dark: { text: "#c3c2b7", muted: "#97968e", grid: "#2b2c33", axis: "#3a3b43", comparison: "#6f6e68", other: "#4a4a47", surface: "#1c1d24" },
};
