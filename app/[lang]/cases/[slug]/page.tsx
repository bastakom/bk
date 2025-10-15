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

  const {
    data: { story },
  } = await getSlugData(pathname, params.lang);

  const maxLength = 150;

  // Properly render the rich text content and create a clean description
  const titleText = renderRichText(story.content.title);
  const contentText = renderRichText(story.content.content);

  // Create description by combining title and content, then clean HTML tags
  let description = `${titleText} - ${contentText}`.replace(/<\/?[^>]+(>|$)/g, "");

  // Use ingress as fallback if available
  if (!description || description.trim() === " - ") {
    description = story.content.ingress || `${story.name} case by Bästa Kompisar`;
  }

  if (description.length > maxLength) {
    description = description.substring(0, maxLength) + "...";
  }

  // Handle video vs image for Open Graph
  let imageUrl = "https://bastakompisar.se/bk-black.png"; // default fallback

  if (story.content.image?.filename) {
    // Check if the hero content is a video
    if (story.content.image.filename.endsWith(".mp4")) {
      // For videos, try to use footer_image or gallery images as fallback
      if (story.content.footer_image?.filename) {
        imageUrl = story.content.footer_image.filename;
      } else if (story.content.gallery && story.content.gallery.length > 0) {
        // Find first non-video image in gallery
        const firstImage = story.content.gallery.find(
          (item: any) => !item.filename.endsWith(".mp4") && !item.filename.endsWith(".mov")
        );
        if (firstImage) {
          imageUrl = firstImage.filename;
        }
      }
      // If no alternative image found, keep the default logo
    } else {
      // It's an image, use it directly
      imageUrl = story.content.image.filename;
    }
  }

  // Ensure the image URL is absolute and uses HTTPS (LinkedIn requirement)
  if (imageUrl && !imageUrl.startsWith("http")) {
    imageUrl = `https://bastakompisar.se${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
  }

  // Convert HTTP to HTTPS if needed (LinkedIn requires HTTPS)
  if (imageUrl && imageUrl.startsWith("http://")) {
    imageUrl = imageUrl.replace("http://", "https://");
  }

  const siteUrl = "https://bastakompisar.se";
  const currentUrl = `${siteUrl}/${params.lang}/cases/${pathname}`;

  return {
    title: `${story.name} – Bästa Kompisar kundcase`,
    description,
    openGraph: {
      title: `${story.name} – Bästa Kompisar kundcase`,
      description,
      url: currentUrl,
      siteName: "Bästa Kompisar",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${story.name} - ${titleText.replace(/<\/?[^>]+(>|$)/g, "")}`,
        },
      ],
      locale: params.lang === "sv" ? "sv_SE" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${story.name} – Bästa Kompisar kundcase`,
      description,
      images: [imageUrl],
    },
    // LinkedIn-specific meta tags
    other: {
      "og:image": imageUrl,
      "og:image:secure_url": imageUrl,
      "og:image:width": "1200",
      "og:image:height": "630",
      "og:image:type": "image/jpeg",
      "article:author": "Bästa Kompisar",
      "article:publisher": "https://bastakompisar.se",
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
