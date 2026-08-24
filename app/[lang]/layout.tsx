import Header from "./components/Header";
import Footer from "./components/Footer";
import StructuredData from "./components/StructuredData";
import { buildPageMetadata } from "../lib/seo";
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

export default function LangLayout({
  children,
  params: { lang },
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  return (
    <>
      <StructuredData />
      <Header locale={lang} />
      <main>{children}</main>
      <Footer locale={lang} />
    </>
  );
}
