import { getStoryblokApi, renderRichText } from "@storyblok/react/rsc";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CaseRenderer from "@/components/NewCase/CaseRenderer";
import JsonLd from "../../components/JsonLd";
import BreadcrumbJsonLd from "../../components/BreadcrumbJsonLd";
import { buildStoryblokSeoMetadata, siteName, siteUrl } from "../../../lib/seo";

const storyblokVersion: "published" | "draft" =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === "true"
    ? "draft"
    : "published";

const getSlugData = async (slug: string, locale: string) => {
  const storyblokApi = getStoryblokApi();

  return storyblokApi.get(
    `cdn/stories/case/${slug}`,
    {
      version: storyblokVersion,
      language: locale,
    },
    {
      cache: "no-store",
    }
  );
};

function stripHtml(value: string) {
  return value.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength = 150) {
  const cleanValue = value.replace(/\s+/g, " ").trim();
  return cleanValue.length > maxLength
    ? `${cleanValue.substring(0, maxLength).replace(/\s+\S*$/, "")}...`
    : cleanValue;
}

function plainText(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(plainText).join(" ");
  if (typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (Array.isArray(value.content)) return value.content.map(plainText).join(" ");

  return "";
}

function richTextToPlainText(value: any) {
  return stripHtml(renderRichText(value) || "") || plainText(value);
}

function storyTitle(story: any) {
  return (
    plainText(story?.content?.title) ||
    story?.content?.title ||
    story?.name ||
    "Case"
  );
}

function storyDescription(story: any, maxLength = 220) {
  const contentText =
    story?.content?.description ||
    story?.content?.ingress ||
    richTextToPlainText(story?.content?.content) ||
    plainText(story?.content);

  return (
    truncate(contentText, maxLength) ||
    `${story?.name || "Case"} från Bästa Kompisar.`
  );
}

function storyImage(story: any) {
  return (
    story?.content?.thumbnail?.filename ||
    story?.content?.image?.filename ||
    story?.content?.preview_image?.filename ||
    `${siteUrl}/bk-black.png`
  );
}

function storyCategories(story: any, lang: string) {
  const tagList = Array.isArray(story?.tag_list) ? story.tag_list : [];

  if (tagList.length > 0) return tagList.filter(Boolean);

  if (lang === "en") {
    return Array.isArray(story?.content?.categoriesen)
      ? story.content.categoriesen.filter(Boolean)
      : [];
  }

  if (Array.isArray(story?.content?.Kategori)) {
    return story.content.Kategori.filter(Boolean);
  }

  return story?.content?.Kategori ? [story.content.Kategori] : [];
}

export async function generateMetadata({
  params,
}: {
  params: {
    slug: string;
    lang: string;
  };
}): Promise<Metadata> {
  let story;

  try {
    const result = await getSlugData(params.slug, params.lang);
    story = result?.data?.story;
  } catch {
    story = undefined;
  }

  const title = `${storyTitle(story)} - Bästa Kompisar kundcase`;
  const metadata = buildStoryblokSeoMetadata({
    content: story?.content,
    fallbackTitle: title,
    fallbackDescription: truncate(storyDescription(story), 150),
    fallbackImage: storyImage(story),
    lang: params.lang,
    path: `/${params.lang}/case/${params.slug}`,
  });

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
    },
    other: {
      "article:author": "Bästa Kompisar",
      "article:publisher": siteUrl,
      ...(story?.published_at ? { "article:published_time": story.published_at } : {}),
      ...(story?.published_at ? { "og:updated_time": story.published_at } : {}),
    },
  };
}

const CasePage = async ({
  params,
}: {
  params: {
    slug: string;
    lang: string;
  };
}) => {
  let story;

  try {
    const result = await getSlugData(params.slug, params.lang);
    story = result?.data?.story;
  } catch {
    notFound();
  }

  if (!story) {
    notFound();
  }

  const pageUrl = `${siteUrl}/${params.lang}/case/${params.slug}`;
  const title = storyTitle(story);
  const description = storyDescription(story);
  const image = storyImage(story);
  const categories = storyCategories(story, params.lang);
  const breadcrumbItems = [
    { label: "Start", href: `/${params.lang}` },
    { label: "Case", href: `/${params.lang}/case` },
    { label: story.name || title },
  ];

  const caseJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${pageUrl}#case`,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    name: story.name || title,
    headline: title,
    description,
    image,
    datePublished: story.first_published_at || story.published_at,
    dateModified: story.published_at || story.first_published_at,
    inLanguage: params.lang === "en" ? "en-US" : "sv-SE",
    genre: categories,
    keywords: categories.join(", "),
    creator: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
    },
    about: categories.map((category: string) => ({
      "@type": "Thing",
      name: category,
    })),
    abstract: description,
  };

  return (
    <main>
      <JsonLd data={caseJsonLd} />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <CaseRenderer story={story} />
    </main>
  );
};

export default CasePage;
