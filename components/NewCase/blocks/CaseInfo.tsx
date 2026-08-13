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
          <p className="text-base font-normal leading-tight text-black lg:col-start-1 lg:row-start-1 lg:text-xl">
            {blok.client}
          </p>
        )}

        {blok.title && (
          <h1
            className="mt-5 max-w-[32ch] text-[clamp(2.5rem,11vw,3.125rem)] font-normal leading-[1.05] text-[#25364F] lg:col-span-2 lg:col-start-2 lg:row-start-1 lg:mt-0 lg:text-6xl"
          >
            {blok.title}
          </h1>
        )}

        <div className="mt-5 flex flex-col justify-between gap-10 lg:col-start-1 lg:row-start-2">
          {categories.length > 0 && (
            <ul className="text-base font-light-sofia leading-tight text-[#545454] lg:text-xl">
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
              className="hidden w-fit text-left text-xl font-normal text-[#FF6062] lg:block"
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
          <div className="mt-5 max-w-[70ch] text-base font-light-sofia leading-snug text-black lg:col-span-2 lg:col-start-2 lg:row-start-2 lg:text-xl">
            {render(blok.introduction)}
          </div>
        )}

        {details.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            className="mt-5 w-fit text-left text-xl font-normal text-[#FF6062] lg:hidden"
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
              <div className="mt-5 flex max-w-[70ch] flex-col gap-5 text-base font-light-sofia text-black lg:text-xl">
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
