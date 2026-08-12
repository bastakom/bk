import { storyblokEditable } from "@storyblok/react/rsc";
import CaseMediaItem from "./CaseMediaItem";

interface CaseMediaRowBlok {
  [key: string]: any;

  _uid: string;
  component: string;
  items?: any[];
  aspect_ratio?: "16/9" | "3/2" | "1/1" | "4/5" | "9/16";
  width?: "full" | "content" | "narrow";
  gap?: "none" | "small" | "medium" | "large";
  mobile_layout?: "stacked" | "horizontal";
}

interface CaseMediaRowProps {
  blok: CaseMediaRowBlok;
}

const widthClasses = {
  full: "full-width-element",
  content: "mx-auto w-full max-w-[1600px]",
  narrow: "mx-auto w-full max-w-5xl",
};

const gapClasses = {
  none: "gap-0",
  small: "gap-2",
  medium: "gap-5",
  large: "gap-10",
};

const CaseMediaRow = ({ blok }: CaseMediaRowProps) => {
  const items = Array.isArray(blok.items) ? blok.items.slice(0, 3) : [];

  if (items.length === 0) return null;

  const aspectRatio = blok.aspect_ratio || "16/9";
  const widthClass = widthClasses[blok.width || "content"];
  const gapClass = gapClasses[blok.gap || "medium"];

  const desktopColumns =
    items.length === 1
      ? "md:grid-cols-1"
      : items.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-3";

  const mobileColumns =
    blok.mobile_layout === "horizontal"
      ? items.length === 1
        ? "grid-cols-1"
        : items.length === 2
          ? "grid-cols-2"
          : "grid-cols-3"
      : "grid-cols-1";

  return (
    <section {...storyblokEditable(blok)} className={widthClass}>
      <div className={`grid ${mobileColumns} ${desktopColumns} ${gapClass}`}>
        {items.map((item) => (
          <CaseMediaItem
            key={item._uid}
            blok={item}
            aspectRatio={aspectRatio}
          />
        ))}
      </div>
    </section>
  );
};

export default CaseMediaRow;
