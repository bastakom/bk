import Image from "next/image";
import { storyblokEditable } from "@storyblok/react/rsc";

interface StoryblokAsset {
  filename?: string;
  alt?: string;
}

interface CaseMediaItemBlok {
  [key: string]: any;

  _uid: string;
  component: string;
  media?: StoryblokAsset;
  mobile_media?: StoryblokAsset;
  alt_text?: string;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  object_position?: "center" | "top" | "bottom";
  caption?: string;
}

interface CaseMediaItemProps {
  blok: CaseMediaItemBlok;
  aspectRatio: string;
}

const isVideo = (filename: string) =>
  /\.(mp4|mov|webm)(\?.*)?$/i.test(filename);

const CaseMediaItem = ({ blok, aspectRatio }: CaseMediaItemProps) => {
  const desktopUrl = blok.media?.filename;
  const mobileUrl = blok.mobile_media?.filename;
  const objectPosition = blok.object_position || "center";

  if (!desktopUrl) return null;

  const renderMedia = (url: string, mobile = false) => {
    if (isVideo(url)) {
      return (
        <video
          autoPlay={Boolean(blok.autoplay)}
          controls={Boolean(blok.controls)}
          loop={Boolean(blok.loop)}
          muted={Boolean(blok.autoplay || blok.muted)}
          playsInline
          preload={blok.autoplay ? "auto" : "metadata"}
          className="h-full w-full object-cover"
          style={{ objectPosition }}
        >
          <source src={url} />
        </video>
      );
    }

    const asset = mobile ? blok.mobile_media : blok.media;

    return (
      <Image
        src={url}
        alt={blok.alt_text || asset?.alt || ""}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover"
        style={{ objectPosition }}
      />
    );
  };

  return (
    <figure {...storyblokEditable(blok)} className="min-w-0">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio }}>
        {mobileUrl ? (
          <>
            <div className="relative h-full w-full md:hidden">
              {renderMedia(mobileUrl, true)}
            </div>
            <div className="relative hidden h-full w-full md:block">
              {renderMedia(desktopUrl)}
            </div>
          </>
        ) : (
          renderMedia(desktopUrl)
        )}
      </div>

      {blok.caption && (
        <figcaption className="mt-2 text-sm font-light-sofia">
          {blok.caption}
        </figcaption>
      )}
    </figure>
  );
};

export default CaseMediaItem;
