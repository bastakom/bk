/**
 * Landsnamn och koder från plattformarna (GA4: "Sweden", Meta: "SE" …) → ISO-koder,
 * så att kartan kan färga rätt land och visa svenska namn.
 */
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import sv from "i18n-iso-countries/langs/sv.json";

countries.registerLocale(en);
countries.registerLocale(sv);

/** Namn som plattformarna använder men som inte finns i ISO-listan. */
const ALIASES: Record<string, string> = { laos: "LA", "bosnia & herzegovina": "BA", kosovo: "XK", "türkiye": "TR", "turkiye": "TR", "macao": "MO", "côte d’ivoire": "CI" };

/** Alpha-2-kod för ett landsvärde, eller null om det inte går att känna igen. */
export function countryCode(value: string): string | null {
  const v = value.trim();
  const alias = ALIASES[v.toLowerCase()];
  if (alias) return alias;
  if (/^[A-Za-z]{2}$/.test(v) && countries.isValid(v.toUpperCase())) return v.toUpperCase();
  if (/^[A-Za-z]{3}$/.test(v)) return countries.alpha3ToAlpha2(v.toUpperCase()) ?? null;
  return countries.getAlpha2Code(v, "en") ?? countries.getAlpha2Code(v, "sv") ?? null;
}

/** ISO 3166-1 numerisk kod (som världskartans id), t.ex. "752" för Sverige. */
export const numericCode = (alpha2: string) => countries.alpha2ToNumeric(alpha2) ?? null;

export const swedishName = (alpha2: string) => countries.getName(alpha2, "sv") ?? alpha2;
export const countryName = (alpha2: string, lang: "sv" | "en" = "sv") => countries.getName(alpha2, lang) ?? alpha2;
