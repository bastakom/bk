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
  const categories = blok.categories
    ? blok.categories
        .split("\n")
        .map((category) => category.trim())
        .filter(Boolean)
    : [];

  return (
    <section
      {...storyblokEditable(blok)}
      className="full-width-element px-5 py-10"
    >
      <div className="grid grid-cols-1 gap-x-5 lg:grid-cols-3">
        {blok.client && (
          <p className="text-[clamp(1rem,1.2vw,1.875rem)] font-semibold leading-tight lg:col-start-1 lg:row-start-1">
            {blok.client}
          </p>
        )}

        {blok.title && (
          <h1
            className="mt-5 max-w-[70ch] text-[clamp(2rem,3vw,3.75rem)] font-semibold leading-[1.05] lg:col-span-2 lg:col-start-2 lg:row-start-1 lg:mt-0"
            style={{ color: "#111" }}
          >
            {blok.title}
          </h1>
        )}

        <div className="mt-10 flex flex-col justify-between gap-10 lg:col-start-1 lg:row-start-2 lg:mt-5">
          {categories.length > 0 && (
            <ul className="text-[clamp(1rem,1.2vw,1.875rem)] font-light-sofia leading-tight text-[#545454]">
              {categories.map((category) => (
                <li key={category}>{category}</li>
              ))}
            </ul>
          )}

          {details.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              aria-expanded={isOpen}
              className="w-fit text-left text-[clamp(1rem,1.2vw,1.875rem)] font-semibold"
            >
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-500 ease-in-out"
              >
                {isOpen ? "−" : "+"}
              </span>{" "}
              {blok.toggle_label || "Vad har vi gjort"}
            </button>
          )}
        </div>

        {blok.introduction && (
          <div className="mt-5 max-w-[70ch] font-light-sofia text-[clamp(1rem,1.2vw,1.875rem)] leading-snug lg:col-span-2 lg:col-start-2 lg:row-start-2">
            {render(blok.introduction)}
          </div>
        )}

        {details.length > 0 && (
          <div
            className={`grid lg:col-span-2 lg:col-start-2 lg:row-start-3 transition-[grid-template-rows,opacity] duration-500 ease-in-out ${
              isOpen
                ? "grid-rows-[1fr] opacity-100"
                : "pointer-events-none grid-rows-[0fr] opacity-0"
            }`}
            aria-hidden={!isOpen}
          >
            <div className="overflow-hidden">
              <div className="mt-5 flex max-w-[70ch] flex-col gap-5 font-light-sofia text-[clamp(1rem,1.2vw,1.875rem)]">
                {details.map((detail) => (
                  <CaseInfoItem key={detail._uid} blok={detail} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default CaseInfo;
