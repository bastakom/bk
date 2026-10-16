import { config } from "dotenv";
import type { NextConfig } from "next";
import { resolve } from "node:path";

// En gemensam .env i repots rot för alla paket.
config({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  // Appen ligger bakom inloggning och är helt dynamisk, så Cache Components ger
  // ingen vinst här i fas 1. Kan slås på per route senare (t.ex. delningslänkar).
  cacheComponents: false,
  // Utvecklingsindikatorn får inte hamna i PDF:er som renderas lokalt.
  devIndicators: false,
  transpilePackages: ["@rp/core", "@rp/db", "@rp/reports"],
  serverExternalPackages: ["pg", "playwright", "playwright-core", "pdfjs-dist"],
  turbopack: {
    root: resolve(import.meta.dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
