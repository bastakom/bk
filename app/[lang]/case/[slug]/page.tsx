import { getStoryblokApi } from "@storyblok/react";
import { notFound } from "next/navigation";
import { StoryblokComponent } from "@storyblok/react";
import { Metadata } from "next";

const storyblokVersion: "published" | "draft" =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === "true"
    ? "draft"
    : "published";

const getSlugData = async (slug: string, locale: string) => {
  const sbParams = {
    version: storyblokVersion,
    language: locale,
  };

  const storyblokApi = getStoryblokApi();

  return await storyblokApi.get(`cdn/stories/case/${slug}`, sbParams, {
    cache: "no-store",
  });
};

const getAllSlugs = async (locale: string) => {
  const sbParams = {
    version: storyblokVersion,
    starts_with: "case/",
    language: locale,
  };

  const storyblokApi = getStoryblokApi();

  return await storyblokApi.get(`cdn/stories`, sbParams, {
    cache: "no-store",
  });
};

export async function generateMetadata({
  params,
}: {
  params: { slug: string; lang: string };
}): Promise<Metadata> {
  const pathname = params.slug;

  let story;

  try {
    const result = await getSlugData(pathname, params.lang);
    story = result?.data?.story;
  } catch {
    story = undefined;
  }

  const siteUrl = "https://bastakompisar.se";
  const currentUrl = `${siteUrl}/${params.lang}/case/${pathname}`;

  const title =
    story?.content?.title || story?.name || "Case";

  const description =
    story?.content?.description ||
    story?.content?.ingress ||
    `${story?.name || "Case"} by Bästa Kompisar`;

  let imageUrl = "https://bastakompisar.se/bk-black.png";

  if (story?.content?.thumbnail?.filename) {
    imageUrl = story.content.thumbnail.filename;
  }

  return {
    metadataBase: new URL(siteUrl),
    title: `${title} – Bästa Kompisar kundcase`,
    description,
    openGraph: {
      title: `${title} – Bästa Kompisar kundcase`,
      description,
      url: currentUrl,
      siteName: "Bästa Kompisar",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${title} - Bästa Kompisar`,
        },
      ],
      locale: params.lang === "sv" ? "sv_SE" : "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} – Bästa Kompisar kundcase`,
      description,
      images: [imageUrl],
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
    <main>
      <StoryblokComponent blok={story.content} />
    </main>
  );
};

export default page;
