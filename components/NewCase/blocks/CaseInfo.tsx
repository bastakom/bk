"use client";

import { useState } from "react";
import { storyblokEditable } from "@storyblok/react";
import { render } from "storyblok-rich-text-react-renderer";
import CaseInfoItem from "./CaseInfoItem";

interface CaseInfoProps {
  blok: {
    [key: string]: any;
    _uid: string;
    component: string;
    _caseTags?: string[];
    client?: string;
    categories?: string;
    title?: string;
    introduction?: any;
    toggle_label?: string;
    details?: any[];
  };
}

const CaseInfo = ({ blok }: CaseInfoProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const details = Array.isArray(blok.details) ? blok.details : [];

  const legacyCategories = blok.categories
    ? blok.categories
        .split("\n")
        .map((category) => category.trim())
        .filter(Boolean)
    : [];

  const categories =
    Array.isArray(blok._caseTags) && blok._caseTags.length > 0
      ? blok._caseTags
      : legacyCategories;

  const detailsId = `case-info-details-${blok._uid}`;
  const toggleLabel = blok.toggle_label || "Läs mer om projektet";

  return (
    <section {...storyblokEditable(blok)} className="full-width-element">
      <div className="bg-white px-5 py-16 lg:px-10 lg:py-24">
        <div className="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-x-24">
          <div className="flex flex-col items-start">
            {blok.client && (
              <p className="text-sm font-normal uppercase tracking-[0.06em] text-black lg:text-base">
                Kund: {blok.client}
              </p>
            )}

            {blok.title && (
              <h1 className="mt-5 max-w-[14ch] text-[clamp(3rem,5vw,4.5rem)] font-normal leading-[1.02] !text-black">
                {blok.title}
              </h1>
            )}

            {details.length > 0 && (
              <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-expanded={isOpen}
                aria-controls={detailsId}
                className="mt-12 w-fit text-left text-lg font-normal text-[#5A9FCB] transition-colors duration-300 hover:text-[#25364F] lg:mt-16 lg:text-xl"
              >
                <span aria-hidden="true">{isOpen ? "−" : "+"}</span>{" "}
                {toggleLabel}
              </button>
            )}
          </div>

          {blok.introduction && (
            <div className="max-w-[42ch] text-lg font-light-sofia leading-[1.45] text-black lg:text-xl">
              {render(blok.introduction)}
            </div>
          )}
        </div>
      </div>

      {details.length > 0 && (
        <div
          id={detailsId}
          className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${
            isOpen
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0"
          }`}
          aria-hidden={!isOpen}
        >
          <div className="overflow-hidden">
            <div className="bg-[#EEF3F7] px-5 py-16 lg:px-10 lg:py-20">
              <div className="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-x-24">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-8">
                  <h2 className="text-lg font-bold-sofia leading-snug !text-black">
                    Tjänster
                  </h2>

                  {categories.length > 0 && (
                    <ul className="flex flex-col gap-1 text-lg font-normal leading-[1.4] text-black">
                      {categories.map((category) => (
                        <li key={category}>{category}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col gap-8">
                  {details.map((detail) => (
                    <CaseInfoItem key={detail._uid} blok={detail} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CaseInfo;
