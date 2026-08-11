import Image from "next/image";
import { storyblokEditable } from "@storyblok/react/rsc";

interface CaseHeroMediaProps {
  blok: {
    _uid: string;
    component: string;
    media?: {
      filename?: string;
      alt?: string;
    };
    mobile_media?: {
      filename?: string;
      alt?: string;
    };
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

  if (!desktopUrl) {
    return null;
  }

  const renderMedia = (url: string, mobile = false) => {
    if (isVideo(url)) {
      return (
        <video
          autoPlay
          muted
          loop
          playsInline
          controls={blok.show_controls}
          className="h-full w-full object-cover"
          style={{ objectPosition: position }}
        >
          <source src={url} />
        </video>
      );
    }

    return (
      <Image
        src={url}
        alt={blok.alt_text || blok.media?.alt || ""}
        fill
        priority
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: position }}
      />
    );
  };

  return (
    <section
      {...storyblokEditable(blok)}
      className="full-width-element relative h-[60vh] min-h-[420px] lg:h-[85vh]"
    >
      {mobileUrl && (
        <div className="relative h-full w-full lg:hidden">
          {renderMedia(mobileUrl, true)}
        </div>
      )}

      <div
        className={`relative h-full w-full ${
          mobileUrl ? "hidden lg:block" : "block"
        }`}
      >
        {renderMedia(desktopUrl)}
      </div>
    </section>
  );
};

export default CaseHeroMedia;
