import { getStoryblokApi, renderRichText } from "@storyblok/react";
import { notFound } from "next/navigation";
import CaseSlugPage from "../../components/Cases/CaseSlugPage";
import Breadcrumbs from "../../components/Breadcrumbs";
import type { Metadata } from "next";
import { buildStoryblokSeoMetadata } from "../../../lib/seo";

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
  return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
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

  const titleText =
    story?.content && isRichText(story.content.title)
      ? stripHtml(renderRichText(story.content.title))
      : "";
  const contentText =
    story?.content && isRichText(story.content.content)
      ? stripHtml(renderRichText(story.content.content))
      : "";
  const description =
    story?.content?.ingress ||
    truncate(stripHtml(`${titleText} ${contentText}`)) ||
    `${story?.name || "Case"} från Bästa Kompisar.`;
  const image =
    story?.content?.image?.filename ||
    story?.content?.preview_image?.filename ||
    undefined;
  const title = `${story?.name || "Case"} - Bästa Kompisar kundcase`;
  const metadata = buildStoryblokSeoMetadata({
    content: story?.content,
    fallbackTitle: title,
    fallbackDescription: truncate(description),
    fallbackImage: image,
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

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Start", href: `/${params.lang}` },
          { label: "Case", href: `/${params.lang}/cases` },
          { label: story.name },
        ]}
      />
      <CaseSlugPage story={story} nextCaseSlug={nextCaseSlug} />
    </>
  );
};

export default page;
