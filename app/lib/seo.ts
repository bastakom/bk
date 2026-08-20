import type { Metadata } from "next";

export const siteUrl = "https://bastakompisar.se";
export const siteName = "Bästa Kompisar";

const defaultTitle = "Bästa Kompisar - Fullservice- och filmproduktionsbyrå i Malmö";
const defaultDescription =
  "Kreativ reklambyrå och filmproduktionsbyrå i Malmö. Vi hjälper B2B-bolag, industrier och offentliga verksamheter med strategi, varumärke, webb, film och kampanjer.";
const defaultImage = `${siteUrl}/bk-black.png`;

type SupportedLang = "sv" | "en";

type StoryblokAsset = {
  filename?: string;
};

type StoryblokSeoFields = {
  title?: string;
  meta_title?: string;
  seo_title?: string;
  description?: string;
  meta_description?: string;
  seo_description?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string | StoryblokAsset;
  social_image?: string | StoryblokAsset;
  canonical_url?: string;
  index?: boolean;
  noindex?: boolean;
};

type StoryblokContentWithSeo = {
  Meta?: StoryblokSeoFields;
  meta?: StoryblokSeoFields;
  seo?: StoryblokSeoFields;
  SEO?: StoryblokSeoFields;
};

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

function cleanText(value?: string) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function assetUrl(value?: string | StoryblokAsset) {
  if (typeof value === "string") return value || undefined;
  return value?.filename || undefined;
}

export function getStoryblokSeoFields(content?: StoryblokContentWithSeo) {
  return content?.seo || content?.SEO || content?.Meta || content?.meta || {};
}

export function buildStoryblokSeoMetadata({
  content,
  fallbackTitle,
  fallbackDescription,
  fallbackImage,
  path,
  lang,
}: {
  content?: StoryblokContentWithSeo;
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackImage?: string;
  path: string;
  lang: string;
}): Metadata {
  const seo = getStoryblokSeoFields(content);
  const title = cleanText(seo.title || seo.meta_title || seo.seo_title) || fallbackTitle;
  const description =
    cleanText(seo.description || seo.meta_description || seo.seo_description) ||
    fallbackDescription;
  const image =
    assetUrl(seo.og_image) ||
    assetUrl(seo.social_image) ||
    fallbackImage ||
    defaultImage;
  const canonicalPath = seo.canonical_url?.startsWith(siteUrl)
    ? seo.canonical_url.replace(siteUrl, "")
    : path;

  return {
    ...buildPageMetadata({
      title,
      description,
      image,
      path: canonicalPath,
      lang,
    }),
    robots:
      seo.noindex || seo.index === false
        ? {
            index: false,
            follow: false,
            googleBot: {
              index: false,
              follow: false,
            },
          }
        : undefined,
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
