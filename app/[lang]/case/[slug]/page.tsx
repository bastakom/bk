import {
  getStoryblokApi,
  StoryblokStory,
} from "@storyblok/react/rsc";
import { notFound } from "next/navigation";
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

  return storyblokApi.get(`cdn/stories/case/${slug}`, sbParams, {
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
    story?.content?.title ||
    story?.name ||
    "Case";

  const description =
    story?.content?.description ||
    story?.content?.ingress ||
    `${story?.name || "Case"} by Bästa Kompisar`;

  const imageUrl =
    story?.content?.thumbnail?.filename ||
    "https://bastakompisar.se/bk-black.png";

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
          alt: `${title} – Bästa Kompisar`,
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

const CasePage = async ({
  params,
}: {
  params: { slug: string; lang: string };
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

  return (
    <main>
      <StoryblokStory story={story} />
    </main>
  );
};

export default CasePage;
