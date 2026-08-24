import { getStoryblokApi, renderRichText } from "@storyblok/react";
import { notFound } from "next/navigation";
import CaseSlugPage from "../../components/Cases/CaseSlugPage";
import Breadcrumbs from "../../components/Breadcrumbs";
import BreadcrumbJsonLd from "../../components/BreadcrumbJsonLd";
import JsonLd from "../../components/JsonLd";
import type { Metadata } from "next";
import { buildStoryblokSeoMetadata, siteName, siteUrl } from "../../../lib/seo";

const storyblokVersion: "published" | "draft" =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === "true"
    ? "draft"
    : "published";

const getSlugData = async (slug: string, locale: string) => {
  let sbParams = {
    version: storyblokVersion,
    language: locale,
  };

  const storyblokApi = getStoryblokApi();

  return await storyblokApi.get(`cdn/stories/cases/${slug}`, sbParams, {
    cache: "no-store",
  });
};

const getAllSlugs = async (locale: string) => {
  let sbParams = {
    version: storyblokVersion,
    starts_with: "cases/",
    language: locale,
  };

  const storyblokApi = getStoryblokApi();

  return await storyblokApi.get(`cdn/stories`, sbParams, {
    cache: "no-store",
  });
};

function stripHtml(value: string) {
  return value.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s+/g, " ").trim();
}

function isRichText(value: any) {
  return (
    value &&
    typeof value === "object" &&
    (Array.isArray(value.content) || value.type)
  );
}

function truncate(value: string, maxLength = 150) {
  const cleanValue = value.replace(/\s+/g, " ").trim();
  return cleanValue.length > maxLength
    ? `${cleanValue.substring(0, maxLength).replace(/\s+\S*$/, "")}...`
    : cleanValue;
}

function richTextToPlainText(value: any) {
  return isRichText(value) ? stripHtml(renderRichText(value) || "") : "";
}

function storyCategories(story: any, lang: string) {
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

function storyDescription(story: any, maxLength = 220) {
  const titleText = richTextToPlainText(story?.content?.title);
  const contentText = richTextToPlainText(story?.content?.content);

  return (
    story?.content?.ingress ||
    story?.content?.meta_description ||
    truncate(stripHtml(`${titleText} ${contentText}`), maxLength) ||
    `${story?.name || "Case"} från Bästa Kompisar.`
  );
}

function storyImage(story: any) {
  return (
    story?.content?.image?.filename ||
    story?.content?.preview_image?.filename ||
    `${siteUrl}/bk-black.png`
  );
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; lang: string };
}): Promise<Metadata> {
  let story;

  try {
    const result = await getSlugData(params.slug, params.lang);
    story = result?.data?.story;
  } catch {
    story = undefined;
  }

  const title = `${story?.name || "Case"} - Bästa Kompisar kundcase`;
  const metadata = buildStoryblokSeoMetadata({
    content: story?.content,
    fallbackTitle: title,
    fallbackDescription: truncate(storyDescription(story), 150),
    fallbackImage: storyImage(story),
    lang: params.lang,
    path: `/${params.lang}/cases/${params.slug}`,
  });

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: "article",
    },
    other: {
      "article:author": "Bästa Kompisar",
      "article:publisher": "https://bastakompisar.se",
      ...(story?.published_at ? { "article:published_time": story.published_at } : {}),
      ...(story?.published_at ? { "og:updated_time": story.published_at } : {}),
    },
  };
}

const page = async ({
  params,
}: {
  params: { slug: string; lang: string };
}) => {
  const pathname = params.slug;

  let story;

  try {
    const result = await getSlugData(pathname, params.lang);
    story = result?.data?.story;
  } catch {
    notFound();
  }

  if (!story) {
    notFound();
  }

  let stores: any[] = [];

  try {
    const result = await getAllSlugs(params.lang);
    stores = result?.data?.stories || [];
  } catch {
    stores = [];
  }

  const slugs = stores.map((item: any) => item.slug);
  const currentIndex = slugs.indexOf(pathname);
  const nextCaseSlug =
    slugs.length > 0 && currentIndex !== -1
      ? slugs[(currentIndex + 1) % slugs.length]
      : "";

  const pageUrl = `${siteUrl}/${params.lang}/cases/${params.slug}`;
  const breadcrumbItems = [
    { label: "Start", href: `/${params.lang}` },
    { label: "Case", href: `/${params.lang}/cases` },
    { label: story.name },
  ];
  const description = storyDescription(story);
  const image = storyImage(story);
  const categories = storyCategories(story, params.lang);
  const publishedDate = story.first_published_at || story.published_at;
  const modifiedDate = story.published_at || story.first_published_at;

  const caseJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${pageUrl}#case`,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    name: story.name,
    headline: story.name,
    description,
    image,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    inLanguage: params.lang === "en" ? "en-US" : "sv-SE",
    genre: categories,
    keywords: categories.join(", "),
    isPartOf: {
      "@type": "CollectionPage",
      "@id": `${siteUrl}/${params.lang}/cases#cases`,
      name: "Case",
      url: `${siteUrl}/${params.lang}/cases`,
    },
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
    <>
      <JsonLd data={caseJsonLd} />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <Breadcrumbs items={breadcrumbItems} />
      <CaseSlugPage story={story} nextCaseSlug={nextCaseSlug} />
    </>
  );
};

export default page;
