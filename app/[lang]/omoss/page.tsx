import type { Metadata } from "next";
import { getStoryblokApi } from "@storyblok/react";
import Image from "next/image";
import { render } from "storyblok-rich-text-react-renderer";
import Button from "../components/Button/Button";
import Link from "next/link";
import { IoMdArrowDown } from "react-icons/io";
import { buildStoryblokSeoMetadata, siteName, siteUrl } from "../../lib/seo";
import StoryblokImage from "../components/StoryblokImage";
import JsonLd from "../components/JsonLd";

const getTeam = async () => {
  let sbParams = {
    version: "published" as const,
    starts_with: "team",
  };

  const storyblokApi = getStoryblokApi();
  const data = await storyblokApi.get(
    `cdn/stories/`,
    sbParams
  );

  return data.data.stories;
};

const fetchConfig = async (locale: string) => {
  let sbParams = {
    version: "draft" as const,
    language: locale,
  };

  const storyblokApi = getStoryblokApi();
  const config = await storyblokApi.get(
    `cdn/stories/config`,
    sbParams,
    {
      cache: "no-store",
    }
  );
  return { config };
};

function plainText(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value.content)) {
    return value.content
      .map((item: any) => plainText(item))
      .filter(Boolean)
      .join(" ");
  }
  if (value.text) return value.text;
  return "";
}

function truncate(value: string, maxLength = 155) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.substring(0, maxLength)}...` : clean;
}

function localizedHref(cachedUrl: string | undefined, locale: string) {
  if (!cachedUrl) return `/${locale}`;
  if (cachedUrl.startsWith("http") || cachedUrl.startsWith("mailto:") || cachedUrl.startsWith("tel:")) {
    return cachedUrl;
  }

  const normalized = cachedUrl.startsWith("/") ? cachedUrl : `/${cachedUrl}`;

  if (normalized === `/${locale}` || normalized.startsWith(`/${locale}/`)) {
    return normalized;
  }

  return `/${locale}${normalized}`.replace(/\/$/, "");
}

export async function generateMetadata({
  params,
}: {
  params: { lang: string };
}): Promise<Metadata> {
  const blok = await fetchConfig(params.lang);
  const configData = blok.config.data.story.content;
  const title = "Om Bästa Kompisar - Reklambyrå i Malmö";
  const description =
    truncate(plainText(configData.about_subtext)) ||
    "Lär känna Bästa Kompisar, en kreativ reklambyrå och filmproduktionsbyrå i Malmö.";
  const image = configData.about_image?.filename || undefined;

  return buildStoryblokSeoMetadata({
    content: configData,
    fallbackTitle: title,
    fallbackDescription: description,
    fallbackImage: image,
    lang: params.lang,
    path: `/${params.lang}/omoss`,
  });
}

const Page = async ({ params }: { params: { lang: string } }) => {
  const res = await getTeam();
  const blok = await fetchConfig(params.lang);
  const configData = blok.config.data.story.content;
  const pageUrl = `${siteUrl}/${params.lang}/omoss`;
  const aboutDescription =
    truncate(plainText(configData.about_subtext), 220) ||
    "Lär känna Bästa Kompisar, en kreativ reklambyrå och filmproduktionsbyrå i Malmö.";

  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${pageUrl}#about`,
    url: pageUrl,
    name: "Om Bästa Kompisar",
    description: aboutDescription,
    inLanguage: params.lang === "en" ? "en-US" : "sv-SE",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: siteName,
      url: siteUrl,
    },
    mainEntity: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
      employee: res.map((member: any) => ({
        "@type": "Person",
        name: member.name,
        jobTitle: member.content?.yrkesroll || undefined,
        email: member.content?.email || undefined,
        telephone: member.content?.telefon || undefined,
        image: member.content?.image?.filename || undefined,
      })),
    },
  };

  return (
    <>
      <JsonLd data={aboutJsonLd} />
      <div className="overflow-x-hidden">
        <div
          className={`min-h-[100%] lg:min-h-[80vh] flex flex-col lg:flex-row ${
            configData.about_marginleft
              ? "w-full lg:w-[80%] m-auto my-10 lg:my-24 gap-10 lg:gap-20"
              : "w-full items-start bg-[#F7F0EE] full-width-element px-4 lg:px-32 gap-10"
          } pt-24 lg:pt-40 pb-5 lg:pb-24 mb-0 lg:mb-14 font-primary`}
        >
          <div
            className={`w-full lg:w-1/2 h-full flex flex-col ${
              configData.about_marginleft
                ? "justify-start"
                : "justify-center"
            }`}
          >
            <div
              className={`flex flex-col w-full ${
                configData.about_marginleft
                  ? "gap-5"
                  : "gap-5 lg:gap-14"
              }`}
            >
              {configData.about_subtitle && (
                <span className="text-lg font-normal">
                  {configData.about_subtitle}
                </span>
              )}
              <h1
                className={`w-full max-w-full lg:max-w-[100%] ${
                  configData.about_marginleft
                    ? "text-[50px] lg:text-[70px] font-normal leading-[50px] lg:leading-[85px]"
                    : "text-[65px] lg:text-[100px] w-[55%] font-normal leading-[70px] lg:leading-[100px] text-[#25364F]"
                }`}
              >
                {render(configData.about_title)}
              </h1>
              <span className="flex flex-col gap-5 max-w-[100%] lg:max-w-[90%] font-light-sofia text-[20px]">
                {render(configData.about_subtext)}
              </span>
              {configData.link_name &&
                configData.about_marginleft && (
                  <Button
                    href={`${configData.about_link.cached_url}`}
                    text={configData.about_linkname}
                  />
                )}
            </div>
          </div>
          {configData.image && (
            <div
              className={`w-full mt-0 lg:mt-10 lg:mt-0 lg:w-1/2 h-full relative ${
                configData.marginleft
                  ? ""
                  : "flex-col flex gap-10"
              }`}
            >
              <StoryblokImage
                asset={configData.about_image}
                alt="Bästa Kompisar team i Malmö"
                width={600}
                height={600}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className={`object-cover ${
                  !configData.marginleft
                    ? "min-h-full max-h-[400px] w-full"
                    : "min-h-[100%] lg:min-h-[50vh] "
                }`}
              />
              {configData.about_link &&
                !configData.about_marginleft && (
                  <Link
                    href={localizedHref(configData.about_link.cached_url, params.lang)}
                    className="link-color flex gap-2 items-center"
                  >
                    {configData.about_linkname}
                    <span>
                      <IoMdArrowDown fontSize={"1.2em"} />
                    </span>
                  </Link>
                )}
            </div>
          )}
        </div>
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 px-5 lg:px-10 mb-14 lg:mb-20"
          id="dinakompisar"
        >
          {res.map((member: any) => (
            <div key={member.id} className="relative group">
              <div className="relative max-h-[520px]">
                {member?.content?.content === "" ? null : (
                  <div
                    className="absolute top-0 h-full text-white w-full p-5 flex items-center bg-[#25364F] opacity-0 group-hover:opacity-90
              transition-all duration-300 ease-in-out text-[16px]"
                  >
                    {render(member?.content?.content)}
                  </div>
                )}
                <Image
                  className="w-full object-cover max-h-[520px] xl:max-h-[520px]"
                  style={{ objectPosition: "50% 50%" }}
                  src={member.content.image.filename}
                  width={800}
                  height={480}
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  alt={member.name}
                />
              </div>
              <h2 className="text-[24px] font-bold-sofia mt-6 text-black">
                {member.name}
              </h2>
              <span className="font-light-sofia text-[14px]">
                <span className="uppercase">
                  {" "}
                  {member.content.yrkesroll}
                </span>{" "}
                <br />
                {member.content.email}
                {member.content.telefon && (
                  <span>
                    <br />
                    {member.content.telefon}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Page;
