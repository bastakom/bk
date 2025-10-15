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

  // Handle video vs image for Open Graph - with better fallback logic
  let imageUrl = "https://bastakompisar.se/bk-black.png"; // default fallback

  // Try multiple sources for a valid image
  const potentialImages = [];

  // Add hero image if it's not a video
  if (story.content.image?.filename && !story.content.image.filename.endsWith(".mp4")) {
    potentialImages.push(story.content.image.filename);
  }

  // Add footer image
  if (story.content.footer_image?.filename) {
    potentialImages.push(story.content.footer_image.filename);
  }

  // Add first few gallery images (non-videos)
  if (story.content.gallery && Array.isArray(story.content.gallery)) {
    story.content.gallery.slice(0, 3).forEach((item: any) => {
      if (item.filename && !item.filename.endsWith(".mp4") && !item.filename.endsWith(".mov")) {
        potentialImages.push(item.filename);
      }
    });
  }

  // Use first available image, ensure it's a full URL
  if (potentialImages.length > 0) {
    let selectedImage = potentialImages[0];

    // Ensure it's a full HTTPS URL
    if (selectedImage.startsWith("//")) {
      selectedImage = `https:${selectedImage}`;
    } else if (selectedImage.startsWith("http://")) {
      selectedImage = selectedImage.replace("http://", "https://");
    } else if (!selectedImage.startsWith("http")) {
      // If it's a relative path, it might be from your domain
      selectedImage = `https://bastakompisar.se${selectedImage.startsWith("/") ? "" : "/"}${selectedImage}`;
    }

    imageUrl = selectedImage;
  }

  console.log("Selected image URL for OG:", imageUrl); // Debug log

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
      type: "article",
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
      "og:image:type": "image/png",
      "og:type": "article",
      "article:author": "Bästa Kompisar",
      "article:publisher": "https://bastakompisar.se",
      "article:published_time": new Date().toISOString(),
      "og:site_name": "Bästa Kompisar",
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
