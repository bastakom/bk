import { storyblokEditable } from "@storyblok/react/rsc";
import CaseMediaItem from "./CaseMediaItem";

type MixedLayout =
  | "16-9_3-2"
  | "3-2_16-9"
  | "16-9_9-16"
  | "9-16_16-9"
  | "9-16_16-9_9-16";

interface CaseMixedMediaRowBlok {
  [key: string]: any;
  _uid: string;
  component: string;
  items?: any[];
  layout?: MixedLayout;
  width?: "full" | "content" | "narrow";
  gap?: "none" | "small" | "medium" | "large";
  mobile_layout?: "stacked" | "horizontal";
}

interface CaseMixedMediaRowProps {
  blok: CaseMixedMediaRowBlok;
}

const layouts: Record<
  MixedLayout,
  { ratios: string[]; desktopColumns: string }
> = {
  "16-9_3-2": {
    ratios: ["16 / 9", "3 / 2"],
    desktopColumns: "md:grid-cols-[32fr_27fr]",
  },
  "3-2_16-9": {
    ratios: ["3 / 2", "16 / 9"],
    desktopColumns: "md:grid-cols-[27fr_32fr]",
  },
  "16-9_9-16": {
    ratios: ["16 / 9", "9 / 16"],
    desktopColumns: "md:grid-cols-[256fr_81fr]",
  },
  "9-16_16-9": {
    ratios: ["9 / 16", "16 / 9"],
    desktopColumns: "md:grid-cols-[81fr_256fr]",
  },
  "9-16_16-9_9-16": {
    ratios: ["9 / 16", "16 / 9", "9 / 16"],
    desktopColumns: "md:grid-cols-[81fr_256fr_81fr]",
  },
};

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

const CaseMixedMediaRow = ({ blok }: CaseMixedMediaRowProps) => {
  const layoutName = blok.layout || "16-9_3-2";
  const layout = layouts[layoutName] || layouts["16-9_3-2"];
  const items = Array.isArray(blok.items)
    ? blok.items.slice(0, layout.ratios.length)
    : [];

  if (items.length === 0) return null;

  const gap = blok.gap || "medium";
  const widthClass =
    blok.width === "full"
      ? "full-width-element"
      : blok.width === "narrow"
        ? "mx-auto w-full max-w-5xl"
        : "mx-auto w-full max-w-[1700px]";
  const horizontalPaddingClass =
    blok.width === "full" ? horizontalPaddingClasses[gap] : "";
  const mobileColumns =
    blok.mobile_layout === "horizontal"
      ? items.length === 3
        ? "grid-cols-3"
        : "grid-cols-2"
      : "grid-cols-1";

  return (
    <section
      {...storyblokEditable(blok)}
      className={`${widthClass} ${horizontalPaddingClass} ${marginBottomClasses[gap]}`}
    >
      <div
        className={`grid ${mobileColumns} ${layout.desktopColumns} ${gapClasses[gap]} md:items-start`}
      >
        {items.map((item, index) => (
          <CaseMediaItem
            key={item._uid}
            blok={item}
            aspectRatio={layout.ratios[index]}
          />
        ))}
      </div>
    </section>
  );
};

export default CaseMixedMediaRow;
