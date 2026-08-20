import Footer from "./components/footer/footer";
import Header from "./components/header/header";
import "./globals.css";
import CookieConsent from "./components/cookie-consent/cookie-consent";
import { getStoryblokApi, StoryblokStory } from "@storyblok/react/rsc";
import StoryblokProvider from "@/components/StoryblokProvider";
import { buildPageMetadata, htmlLangForLang } from "../lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { lang: string };
}): Promise<Metadata> {
  const metadata = buildPageMetadata({
    lang: params.lang,
    path: `/${params.lang}`,
  });

  return {
    ...metadata,
    verification: {
      google: "RziuXeHdEqY29yQxfVmswdEAUEO-x0nvYb2ZVgOpH74",
    },
    robots:
      params.lang === "en"
        ? {
            index: false,
            follow: false,
            googleBot: {
              index: false,
              follow: false,
            },
          }
        : metadata.robots,
  };
}

export default async function RootLayout({
  children,
  params: { lang },
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  let { data } = await fetchData(lang);

  return (
    <StoryblokProvider>
      <html lang={htmlLangForLang(lang)}>
        <body>
          <Header story={data.story} />
          <main>{children}</main>
          <Footer lang={lang} />
          <CookieConsent lang={lang} />
        </body>
      </html>
    </StoryblokProvider>
  );
}

async function fetchData(lang: string) {
  let sbParams = { version: "published", language: lang } as const;

  const storyblokApi = getStoryblokApi();
  return storyblokApi.get(`cdn/stories/config`, sbParams);
}
