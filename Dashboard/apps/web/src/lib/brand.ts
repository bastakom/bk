/**
 * Byråns varumärke (white label): färg, typsnitt och logga.
 * Färgen används som accent i appen, delningssidor och PDF; textfärgen
 * på accenten väljs automatiskt för läsbar kontrast.
 */

export const BRAND_FONTS = {
  "Plus Jakarta Sans": { label: "Plus Jakarta Sans", variable: "--font-jakarta" },
  Figtree: { label: "Figtree", variable: "--font-figtree" },
  Geist: { label: "Geist", variable: "--font-geist-sans" },
  Inter: { label: "Inter", variable: "--font-inter" },
  "DM Sans": { label: "DM Sans", variable: "--font-dm-sans" },
  "IBM Plex Sans": { label: "IBM Plex Sans", variable: "--font-ibm-plex" },
  "Source Sans 3": { label: "Source Sans 3", variable: "--font-source-sans" },
} as const;
export type BrandFont = keyof typeof BRAND_FONTS;

export const fontVar = (font: string) => `var(${(BRAND_FONTS[font as BrandFont] ?? BRAND_FONTS.Figtree).variable})`;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relativ luminans enligt WCAG. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
};

/** Text på accentfärgen: vit eller nästan svart, det som ger bäst kontrast. */
export const onColor = (hex: string) => (contrast(hex, "#ffffff") >= contrast(hex, "#111111") ? "#ffffff" : "#111111");

/** Ljusare variant för mörkt tema (blandar mot vitt tills kontrasten mot mörk yta räcker). */
export function forDark(hex: string): string {
  const [r, g, b] = rgb(hex);
  for (let t = 0; t <= 1; t += 0.05) {
    const mix = [r, g, b].map((v) => Math.round(v + (255 - v) * t));
    const out = `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    if (contrast(out, "#1c1d24") >= 4.5) return out;
  }
  return "#ffffff";
}

/** Mörkare variant som bär vit text (WCAG AA 4,5:1), t.ex. för monogram i källans färg. */
export function forWhiteText(hex: string): string {
  const [r, g, b] = rgb(hex);
  for (let t = 0; t <= 1; t += 0.04) {
    const out = `#${[r, g, b].map((v) => Math.round(v * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
    if (contrast(out, "#ffffff") >= 4.5) return out;
  }
  return "#000000";
}

/** Kundens färg för framhävda block i rapporten (.widget-hero). */
export const clientVars = (color: string): React.CSSProperties => ({ ["--client" as string]: color, ["--client-fg" as string]: onColor(color) }) as React.CSSProperties;

/** Standardfärgen (Bästa Kompisars navy). Temat har en egen, handplockad mörk variant för den. */
export const DEFAULT_BRAND_COLOR = "#25364F";
export const DEFAULT_BRAND_FONT: BrandFont = "Figtree";

export const isDefaultBrand = (color: string) => color.toLowerCase() === DEFAULT_BRAND_COLOR.toLowerCase();

/**
 * Props för ett .brand-scope-område (appen, delningssidan). Egen färg skriver över
 * temats primärfärg; standardfärgen behåller temat (navy ljust, korall mörkt).
 */
export function brandScope(color: string, font: string) {
  return { "data-brand": isDefaultBrand(color) ? "default" : "custom", style: brandStyle(color, font) };
}

/** CSS-variabler som skriver över accentfärgen i ett område. */
export function brandStyle(color: string, font: string): Record<string, string> {
  const dark = forDark(color);
  return {
    "--brand": color,
    "--brand-fg": onColor(color),
    "--brand-dark": dark,
    "--brand-dark-fg": onColor(dark),
    fontFamily: `${fontVar(font)}, ui-sans-serif, system-ui, sans-serif`,
  };
}
