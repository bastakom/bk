import type { Metadata } from "next";
import { storyblokInit, apiPlugin } from "@storyblok/react/rsc";
import "./globals.css";
import "./font.css";
import StoryblokProvider from "@/components/StoryblokProvider";
import { ThemeProvider } from "./[lang]/components/ThemeProvid/theme-provider";

storyblokInit({
  accessToken: "faVE0ToH7Y41wHZy0uSt3Qtt",
  use: [apiPlugin],
  apiOptions: {
    region: "eu",
  },
});

export const metadata: Metadata = {
  title: "Bästa Kompisar - Fullservice- och filmproduktionsbyrå i Malmö",
  description:
    "Kreativ reklambyrå och produktionsbolag i Malmö. Filmproduktion, content och digital kommunikation med fokus på affärsnytta och effekt.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <StoryblokProvider>
      <html lang="sv">
        <body>
          <ThemeProvider defaultTheme="light" attribute="class">
            {children}
          </ThemeProvider>
        </body>
      </html>
    </StoryblokProvider>
  );
}
