import type { Metadata } from "next";
import { storyblokInit, apiPlugin } from "@storyblok/react/rsc";
import "./globals.css";
import "./font.css";
import StoryblokProvider from "@/components/StoryblokProvider";
import { ThemeProvider } from "./[lang]/components/ThemeProvid/theme-provider";
import Head from "next/head";

storyblokInit({
  accessToken: "faVE0ToH7Y41wHZy0uSt3Qtt",
  use: [apiPlugin],
  apiOptions: {
    region: "eu",
  },
});

export const metadata: Metadata = {
  title: "Bästa kompisar malmö",
  description: "En fullservice reklam byrå",
};

export default function RootLayout({
  children,
  params: { lang },
}: Readonly<{
  children: React.ReactNode;
  params: { lang: string };
}>) {
  return (
    <StoryblokProvider>
      <html lang={lang}>
        <Head>
          <meta
            name="google-site-verification"
            content="MVGaWH59KC0hiSCCWnHPFU68sqy2reAmTntOeaK4n-I"
          />
        </Head>
        <body>
          <ThemeProvider defaultTheme="light" attribute="class">
            {children}
          </ThemeProvider>
        </body>
      </html>
    </StoryblokProvider>
  );
}
