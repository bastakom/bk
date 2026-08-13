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

const gapClasses = {
  none: "gap-0",
  small: "gap-2",
  medium: "gap-5",
  large: "gap-10",
};

const horizontalPaddingClasses = {
  none: "px-0",
  small: "px-2",
  medium: "px-5",
  large: "px-10",
};

const marginBottomClasses = {
  none: "mb-0",
  small: "mb-2",
  medium: "mb-5",
  large: "mb-10",
};

const CaseMediaRow = ({ blok }: CaseMediaRowProps) => {
  const items = Array.isArray(blok.items) ? blok.items.slice(0, 3) : [];

  if (items.length === 0) return null;

  const aspectRatio = blok.aspect_ratio || "16/9";
  const gap = blok.gap || "medium";
  const widthClass =
    blok.width === "full"
      ? "full-width-element"
      : blok.width === "narrow"
        ? "mx-auto w-full max-w-5xl"
        : items.length === 1
          ? "mx-auto w-full max-w-[1800px]"
          : "mx-auto w-full max-w-[1700px]";
  const gapClass = gapClasses[gap];
  const horizontalPaddingClass =
    blok.width === "full" ? horizontalPaddingClasses[gap] : "";
  const marginBottomClass = marginBottomClasses[gap];

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
    <section
      {...storyblokEditable(blok)}
      className={`${widthClass} ${horizontalPaddingClass} ${marginBottomClass}`}
    >
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
