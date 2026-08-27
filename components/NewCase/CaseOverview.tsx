"use client";

import { useMemo, useState } from "react";
import { storyblokEditable } from "@storyblok/react";
import { render } from "storyblok-rich-text-react-renderer";
import CaseOverviewCard, { CaseOverviewItem } from "./CaseOverviewCard";

interface CaseOverviewBlok {
  [key: string]: any;
  _uid: string;
  component: string;
  title?: string;
  introduction?: any;
}

interface CaseOverviewProps {
  blok: CaseOverviewBlok;
  items: CaseOverviewItem[];
  lang: string;
}

const CaseOverview = ({ blok, items, lang }: CaseOverviewProps) => {
  const allLabel = lang === "sv" ? "Alla" : "All";
  const [selectedTag, setSelectedTag] = useState("");

  const tags = useMemo(() => {
    const uniqueTags = new Set<string>();

    items.forEach((item) => {
      item._resolvedTags?.forEach((tag) => uniqueTags.add(tag));
    });

    return Array.from(uniqueTags);
  }, [items]);

  const filteredItems = useMemo(
    () =>
      selectedTag
        ? items.filter((item) => item._resolvedTags?.includes(selectedTag))
        : items,
    [items, selectedTag],
  );

  const rows = useMemo(() => {
    const result: CaseOverviewItem[][] = [];

    for (let index = 0; index < filteredItems.length; index += 2) {
      result.push(filteredItems.slice(index, index + 2));
    }

    return result;
  }, [filteredItems]);

  return (
    <section
      {...storyblokEditable(blok)}
      className="full-width-element bg-white pt-[82px] text-[#25364F]"
    >
      <div className="mx-auto w-full max-w-[1800px] px-5 py-12 lg:px-10 lg:py-20">
        {(blok.title || blok.introduction) && (
          <header className="mb-12 grid grid-cols-1 gap-5 lg:mb-20 lg:grid-cols-[9fr_16fr]">
            {blok.title && (
              <h1 className="max-w-[16ch] text-[65px] font-normal leading-[70px] lg:text-[100px] lg:leading-[100px]">
                {blok.title}
              </h1>
            )}

            {blok.introduction && (
              <div className="w-full max-w-[75ch] self-end text-lg font-light-sofia leading-snug text-black lg:text-2xl">
                {render(blok.introduction)}
              </div>
            )}
          </header>
        )}

        {tags.length > 0 && (
          <nav
            aria-label={lang === "sv" ? "Filtrera case" : "Filter cases"}
            className="mb-8 flex flex-wrap gap-x-5 gap-y-2 lg:mb-10"
          >
            <button
              type="button"
              onClick={() => setSelectedTag("")}
              aria-pressed={!selectedTag}
              className={`text-base font-normal transition-colors lg:text-lg ${
                !selectedTag
                  ? "text-[#FF6062]"
                  : "text-[#25364F] hover:text-[#FF6062]"
              }`}
            >
              {allLabel}
            </button>

            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                aria-pressed={selectedTag === tag}
                className={`text-base font-normal transition-colors lg:text-lg ${
                  selectedTag === tag
                    ? "text-[#FF6062]"
                    : "text-[#25364F] hover:text-[#FF6062]"
                }`}
              >
                {tag}
              </button>
            ))}
          </nav>
        )}

        <div className="flex flex-col gap-10 lg:gap-16">
          {rows.map((row, rowIndex) => {
            const isReversed = rowIndex % 2 === 1;
            const columns = isReversed
              ? "lg:grid-cols-[9fr_16fr]"
              : "lg:grid-cols-[16fr_9fr]";
            const ratios: Array<"16 / 9" | "1 / 1"> = isReversed
              ? ["1 / 1", "16 / 9"]
              : ["16 / 9", "1 / 1"];

            return (
              <div
                key={`${selectedTag || "all"}-${rowIndex}`}
                className={`grid grid-cols-1 items-start gap-5 ${columns}`}
              >
                {row.map((item, itemIndex) => (
                  <CaseOverviewCard
                    key={item._uid}
                    item={item}
                    ratio={ratios[itemIndex]}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <p className="py-20 text-lg font-light-sofia text-[#545454]">
            {lang === "sv"
              ? "Det finns inga case med den här taggen ännu."
              : "There are no cases with this tag yet."}
          </p>
        )}
      </div>
    </section>
  );
};

export default CaseOverview;
