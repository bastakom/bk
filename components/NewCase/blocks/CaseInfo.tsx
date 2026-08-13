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
      className="full-width-element px-5 pb-5"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col lg:col-span-1">
          {blok.client && (
            <p className="text-[clamp(1rem,1.2vw,1.875rem)] font-semibold leading-tight">
              {blok.client}
            </p>
          )}

          {categories.length > 0 && (
            <ul className="mt-10 text-[clamp(1rem,1.2vw,1.875rem)] font-light-sofia leading-tight text-[#545454]">
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
              className="mt-10 w-fit text-left text-[clamp(1rem,1.2vw,1.875rem)] font-semibold"
            >
              <span aria-hidden="true">{isOpen ? "−" : "+"}</span>{" "}
              {blok.toggle_label || "Vad har vi gjort"}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-2">
          {blok.title && (
            <h1
              className="text-[clamp(2rem,3vw,3.75rem)] font-semibold leading-[1.05]"
              style={{ color: "#111" }}
            >
              {blok.title}
            </h1>
          )}

          {blok.introduction && (
            <div className="max-w-[70ch] font-light-sofia text-[clamp(1rem,1.2vw,1.875rem)] leading-snug">
              {render(blok.introduction)}
            </div>
          )}

          {isOpen && details.length > 0 && (
            <div className="mt-5 flex flex-col gap-5">
              {details.map((detail) => (
                <CaseInfoItem key={detail._uid} blok={detail} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CaseInfo;
