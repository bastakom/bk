"use client";

import { storyblokEditable } from "@storyblok/react";
import { render } from "storyblok-rich-text-react-renderer";

interface CaseInfoItemProps {
  blok: {
    [key: string]: any;
    _uid: string;
    component: string;
    title?: string;
    content?: any;
  };
}

const CaseInfoItem = ({ blok }: CaseInfoItemProps) => {
  return (
    <article
      {...storyblokEditable(blok)}
      className="flex max-w-[70ch] flex-col gap-1"
    >
      {blok.title && (
        <h2
          className="text-[clamp(1.25rem,1.7vw,2.5rem)] font-semibold leading-tight"
          style={{ color: "#111" }}
        >
          {blok.title}
        </h2>
      )}

      {blok.content && (
        <div className="font-light-sofia text-[clamp(1rem,1.2vw,1.875rem)] leading-snug">
          {render(blok.content)}
        </div>
      )}
    </article>
  );
};

export default CaseInfoItem;
