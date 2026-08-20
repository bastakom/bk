import type { Metadata } from "next";

export const siteUrl = "https://bastakompisar.se";
export const siteName = "Bästa Kompisar";

const defaultTitle = "Bästa Kompisar - Fullservice- och filmproduktionsbyrå i Malmö";
const defaultDescription =
  "Kreativ reklambyrå och filmproduktionsbyrå i Malmö. Vi hjälper B2B-bolag, industrier och offentliga verksamheter med strategi, varumärke, webb, film och kampanjer.";
const defaultImage = `${siteUrl}/bk-black.png`;

type SupportedLang = "sv" | "en";

function supportedLang(lang?: string): SupportedLang {
  return lang === "en" ? "en" : "sv";
}

export function htmlLangForLang(lang?: string): SupportedLang {
  return supportedLang(lang);
}

export function localeForLang(lang?: string): "sv_SE" | "en_US" {
  return supportedLang(lang) === "en" ? "en_US" : "sv_SE";
}

export function hreflangForLang(lang?: string): "sv-SE" | "en-US" {
  return supportedLang(lang) === "en" ? "en-US" : "sv-SE";
}

export function canonicalUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${siteUrl}${normalizedPath}`.replace(/\/$/, normalizedPath === "/" ? "/" : "");
}

function languageAlternates(lang: string | undefined, path: string) {
  return {
    [hreflangForLang(lang)]: canonicalUrl(path),
  };
}

export function buildPageMetadata({
  title = defaultTitle,
  description = defaultDescription,
  path = "/sv",
  lang = "sv",
  image = defaultImage,
}: {
  title?: string;
  description?: string;
  path?: string;
  lang?: string;
  image?: string;
} = {}): Metadata {
  const url = canonicalUrl(path);

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(lang, path),
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: localeForLang(lang),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
