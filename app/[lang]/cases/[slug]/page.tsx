import { getStoryblokApi, renderRichText } from "@storyblok/react";
import CaseSlugPage from "../../components/Cases/CaseSlugPage";
import { Metadata } from "next";
import { render } from "storyblok-rich-text-react-renderer";

const getSlugData = async (slug: string, locale: string) => {
  let sbParams = { version: "published" as const, language: locale };

  const storyblokApi = getStoryblokApi();
  return await storyblokApi.get(`cdn/stories/cases/${slug}`, sbParams);
};

const getAllSlugs = async (locale: string) => {
  let sbParams = {
    version: "published" as const,
    starts_with: "cases/",
    language: locale,
  };

  const storyblokApi = getStoryblokApi();
  return await storyblokApi.get(`cdn/stories`, sbParams);
};
export async function generateMetadata({ params }: { params: { slug: string; lang: string } }): Promise<Metadata> {
  const pathname = params.slug;
  let story;
  try {
    const result = await getSlugData(pathname, params.lang);
    story = result?.data?.story;
  } catch {
    story = undefined;
  }
  const maxLength = 150;
  const isRichText = (val: any) => val && typeof val === "object" && (Array.isArray(val.content) || val.type);
  const titleText =
    story && story.content && isRichText(story.content.title) ? renderRichText(story.content.title) : "";
  const contentText =
    story && story.content && isRichText(story.content.content) ? renderRichText(story.content.content) : "";
  let description = `${titleText} - ${contentText}`.replace(/<\/?[^>]+(>|$)/g, "");
  if (!description || description.trim() === " - ") {
    description =
      story && story.content && story.content.ingress
        ? story.content.ingress
        : `${story?.name || "Case"} by Bästa Kompisar`;
  }
  if (description.length > maxLength) {
    description = description.substring(0, maxLength) + "...";
  }
  let imageUrl = "https://bastakompisar.se/bk-black.png";
  if (
    story &&
    story.content &&
    story.content.Meta &&
    story.content.Meta.og_image &&
    story.content.Meta.og_image.trim() !== ""
  ) {
    imageUrl = story.content.Meta.og_image;
  }
  const siteUrl = "https://bastakompisar.se";
  const currentUrl = `${siteUrl}/${params.lang}/cases/${pathname}`;
  return {
    metadataBase: new URL(siteUrl),
    title: `${story?.name || "Case"} – Bästa Kompisar kundcase`,
    description,
    openGraph: {
      title: `${story?.name || "Case"} – Bästa Kompisar kundcase`,
      description,
      url: currentUrl,
      siteName: "Bästa Kompisar",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${story?.name || "Case"} - ${titleText.replace(/<\/?[^>]+(>|$)/g, "")}`,
        },
      ],
      locale: params.lang === "sv" ? "sv_SE" : "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${story?.name || "Case"} – Bästa Kompisar kundcase`,
      description,
      images: [imageUrl],
    },
    other: {
      "og:image": imageUrl,
      "og:image:secure_url": imageUrl,
      "og:image:width": "1200",
      "og:image:height": "630",
      "og:image:type": imageUrl.endsWith(".png") ? "image/png" : "image/jpeg",
      "og:type": "article",
      "article:author": "Bästa Kompisar",
      "article:publisher": "https://bastakompisar.se",
      "og:site_name": "Bästa Kompisar",
      "og:updated_time": new Date().toISOString(),
    },
  };
}

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const pathname = params.slug;

  const {
    data: { story },
  } = await getSlugData(pathname, params.lang);

  const {
    data: { stories: stores },
  } = await getAllSlugs(params.lang);

  const slugs = stores.map((item: any) => item.slug);
  const currentIndex = slugs.indexOf(pathname);
  const nextCaseSlug = slugs[(currentIndex + 1) % slugs.length];

  return (
    <>
      <CaseSlugPage story={story} nextCaseSlug={nextCaseSlug} />
    </>
  );
};

export default page;
