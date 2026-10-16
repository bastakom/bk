const rtfSv = new Intl.RelativeTimeFormat("sv", { numeric: "auto" });

const rtfEn = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

export function timeAgo(date: Date | null | undefined, now = new Date(), lang: "sv" | "en" = "sv"): string {
  if (!date) return lang === "en" ? "never" : "aldrig";
  const s = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(s);
  const rtf = lang === "en" ? rtfEn : rtfSv;
  if (abs < 60) return lang === "en" ? "just now" : "nyss";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    // Bara ord som börjar med en bokstav: "Alex (demo)" → "A", inte "A(".
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "kund";
