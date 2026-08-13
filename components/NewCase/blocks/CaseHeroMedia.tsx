import Image from "next/image";
import { storyblokEditable } from "@storyblok/react/rsc";

interface StoryblokAsset {
  filename?: string;
  alt?: string;
}

interface CaseHeroMediaProps {
  blok: {
    [key: string]: any;
    _uid: string;
    component: string;
    media?: StoryblokAsset;
    mobile_media?: StoryblokAsset;
    alt_text?: string;
    show_controls?: boolean;
    object_position?: "center" | "top" | "bottom";
  };
}

const isVideo = (filename: string) =>
  /\.(mp4|mov|webm)(\?.*)?$/i.test(filename);

const CaseHeroMedia = ({ blok }: CaseHeroMediaProps) => {
  const desktopUrl = blok.media?.filename;
  const mobileUrl = blok.mobile_media?.filename;
  const position = blok.object_position || "center";

  if (!desktopUrl) return null;

  const renderMedia = (url: string, asset?: StoryblokAsset) => {
    if (isVideo(url)) {
      return (
        <video
          autoPlay
          muted
          loop
          playsInline
          controls={Boolean(blok.show_controls)}
          className="block !h-full !w-full max-w-none !object-contain"
          style={{
            aspectRatio: "16 / 9",
            objectFit: "contain",
            objectPosition: position,
          }}
        >
          <source src={url} />
        </video>
      );
    }

    return (
      <Image
        src={url}
        alt={blok.alt_text || asset?.alt || ""}
        fill
        priority
        sizes="100vw"
        className="object-contain"
        style={{ objectPosition: position }}
      />
    );
  };

  return (
    <section
      {...storyblokEditable(blok)}
      className="relative left-1/2 w-screen max-w-none -translate-x-1/2 overflow-hidden"
      style={{ aspectRatio: "16 / 9" }}
    >
      {mobileUrl && (
        <div className="relative h-full w-full lg:hidden">
          {renderMedia(mobileUrl, blok.mobile_media)}
        </div>
      )}

      <div
        className={`relative h-full w-full ${
          mobileUrl ? "hidden lg:block" : "block"
        }`}
      >
        {renderMedia(desktopUrl, blok.media)}
      </div>
    </section>
  );
};

export default CaseHeroMedia;
