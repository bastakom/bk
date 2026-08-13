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
    <article {...storyblokEditable(blok)} className="flex flex-col gap-1">
      {blok.title && (
        <h2
          className="text-2xl font-bold-sofia leading-tight text-black lg:text-[30px]"
        >
          {blok.title}
        </h2>
      )}

      {blok.content && (
        <div className="text-base font-light-sofia leading-snug text-black lg:text-xl">
          {render(blok.content)}
        </div>
      )}
    </article>
  );
};

export default CaseInfoItem;
