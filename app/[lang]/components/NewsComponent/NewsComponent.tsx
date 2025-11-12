"use client";

import { useState } from "react";
import Link from "next/link";
import { render } from "storyblok-rich-text-react-renderer";
import Image from "next/image";
import { GoPlus } from "react-icons/go";
import { FiMinus } from "react-icons/fi";

interface Props {
  props: {
    sort_by_date: any;
    slug: any;
    full_slug: string;
    name: string;
    published_at: string;
    uuid: string;

    content: {
      future_picture: any;
      image: any;
      kategori: string[];
    };
  }[];

  kategories?: {
    name: string;
    uuid: string;
    translated_slugs?: {
      path: string;
      name: string | null;
      lang: string;
      published: string | null;
    }[];
  }[];
  title?: string;
  titleen?: string
  hero_title?: string
  subtitle?: string
  content?: any
  filename?: any
  locale: string;
  nofilter?: boolean;
}

const NewsComponent = ({ props,
  hero_title,
  subtitle,
  content,
  filename,
  kategories,
  locale,
  nofilter,
}: Props) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredUuid, setHoveredUuid] = useState<string | null>(null);
  const [openFilter, isOpenFilter] = useState(false);

  const handleOpenFilter = () => {
    isOpenFilter(!openFilter);
  };

  const filteredPosts = selectedCategory
    ? props.filter((item) => item.content.kategori.includes(selectedCategory))
    : props;

  const handleMouseEnter = (uuid: string) => {
    setHoveredUuid(uuid);
  };

  const handleMouseLeave = () => {
    setHoveredUuid(null);
  };

  return (
    <div className="m-auto">
      <div className="full-width-element lex gap-14 bg-[#F7F0EE] mb-14 pb-10 pt-20 lg:pt-32 px-4 lg:px-0">
        <div className="container mx-auto items-center grid lg:grid-cols-2 gap-4 gap-14">
          <div>
            {subtitle &&
              <span className="text-[22px] uppercase">
                {subtitle}
              </span>
            }
            <h1 className="text-[65px]">{hero_title}</h1>
            {content &&
              <div className="lg:max-w-[80%] text-[18px] mt-2">
                {render(content)}
              </div>
            }
          </div>
          {filename &&
            <div className="relative h-[600px]">
              <Image
                src={filename}
                fill
                alt="Hero Image"
                className="object-cover"
              />
            </div>
          }
        </div>
      </div>
      {!nofilter && filteredPosts.length > 3 &&
        <button
          className="text-right flex gap-2 items-center justify-end w-full mb-10 font-bold text-[22px]"
          onClick={handleOpenFilter}
        >
          Filter
          <span>
            {!openFilter ? (
              <GoPlus fontSize={"1.5em"} color="#FF6062" />
            ) : (
              <FiMinus fontSize={"1.5em"} color="#FF6062" />
            )}
          </span>
        </button>
      }
      {openFilter && (
        <div className="flex flex-wrap gap-5 mb-6 justify-start border-b-2 border-t-2 p-5">
          <button
            onClick={() => setSelectedCategory("")}
            className={`uppercase ${selectedCategory === "" ? "text-[#FF6063]" : ""
              }`}
          >
            {locale === "en" ? "All news" : "Alla nyheter"}
          </button>
          {kategories && kategories.map((item) => (
            <button
              key={item.uuid}
              onClick={() => setSelectedCategory(item.uuid)}
              className={`uppercase ${selectedCategory === item.uuid ? "text-[#FF6063]" : ""
                }`}
            >
              {locale === "en" && item.translated_slugs
                ? item.translated_slugs.find((slug) => slug.lang === "en")
                  ?.name || item.name
                : item.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid h-full gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-3 lg:px-0">
        {filteredPosts.map((item) => {
          return (
            <Link
              href={`${item.full_slug}`}
              key={item.uuid}
              className="flex flex-col gap-5 mb-10"
              onMouseEnter={() => handleMouseEnter(item.uuid)}
              onMouseLeave={handleMouseLeave}
            >
              {item.content?.future_picture?.filename &&
                <Image
                  src={
                    item.content?.future_picture?.filename
                      ? item.content?.future_picture?.filename
                      : item?.content?.image?.filename
                  }
                  height={390}
                  width={500}
                  className="object-cover"
                  style={{ height: "521px", width: "100%" }}
                  alt={item.name}
                />
              }

              <div className="flex flex-col gap-2">
                <h2
                  className={`text-[30px] max-w-[80%] font-primary font-normal ${hoveredUuid === item.uuid ? "opacity-100" : "opacity-100"
                    }`}
                >
                  {item.name}
                </h2>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default NewsComponent;
