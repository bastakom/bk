#!/usr/bin/env node

/*
  SEO baseline for bastakompisar.se.
  Copy to: scripts/seo-baseline.mjs

  Runs without third-party dependencies on Node 18+.
  Output defaults to: reports/seo-baseline/<timestamp>/
*/

import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const BASE_URL = process.env.SEO_BASE_URL || "https://bastakompisar.se";
const OUTPUT_ROOT = process.env.SEO_OUTPUT_DIR || "reports/seo-baseline";
const MAX_HUB_LINKS = Number(process.env.SEO_MAX_HUB_LINKS || 250);

const HUB_PATHS = [
  "/sv",
  "/sv/cases",
  "/sv/nyheter",
  "/sv/marknadsfika",
  "/sv/filmproduktion",
];

const CONTROL_PATHS = [
  "/sv/marknadsfika/christina-elwing-skanetrafiken",
  "/sv/marknadsfika/henrik-jarl-smeg",
  "/sv/marknadsfika/jenny-holmstedt-homemaid",
  "/sv/marknadsfika/jenny-maltesson-granngarden",
  "/sv/marknadsfika/lars-aberg-tidigare-cmo-axis",
  "/sv/marknadsfika/mariette-lindsjoe-kjell-och-company",
  "/sv/marknadsfika/nilla-hedlund-eldan-recycling",
  "/sv/marknadsfika/patrik-rudenschoeld-assa-abloy",
  "/sv/marknadsfika/peter-fuele-axis",
  "/sv/marknadsfika/robin-jacobsson-bygghemma",
  "/sv/marknadsfika/rutger-hagstad-mff",
  "/sv/nyheter/frontpac-i-ny-foerpackning",
  "/sv/vara-tjanster/cases",
  "/sv/marknadsfika/andreas-nyberg-duni",
  "/sv/marknadsfika/anna-roth-kaehrs",
  "/sv/marknadsfika/elisabeth-levinsohn",
  "/sv/marknadsfika/katarina-mesan-hsb-nordics",
  "/sv/marknadsfika/sebastian-merloev-absfront",
  "/sv/nyheter/baesta-kompisar-gar-med-i-komm-sveriges-kommunikationsbyraer",
  "/sv/nyheter/baesta-kompisar-nominerade-till-arets-byra-2023",
  "/sv/nyheter/baesta-kompisar-x-viktvaektarna",
  "/sv/nyheter/brand-movie-foer-gaim",
  "/sv/nyheter/davida-vaeljer-baesta-kompisar-efter-pitch",
  "/sv/nyheter/dogman-and-friends",
  "/sv/nyheter/film-och-soundbranding-foer-daily-greens",
  "/sv/nyheter/gripen",
  "/sv/nyheter/hej-jaegersro-center",
  "/sv/nyheter/ljudets-kraft-i-varumaerkesbyggande-vart-samarbete-med-scorett",
  "/sv/nyheter/nu-visas-baesta-kompisars-film-foer-viktvaektarna-usa-pa-nasdaq",
  "/sv/nyheter/ny-illustration-foer-im",
  "/sv/nyheter/ny-kund-homemaid",
  "/sv/nyheter/ny-kund-tepe-brush-along",
  "/sv/nyheter/ny-kund-voady",
  "/sv/nyheter/ny-webb-at-aoptik",
  "/sv/nyheter/nytt-ar-nytt-kontor",
  "/sv/nyheter/re-hydrate-redo-att-ta-plats",
  "/sv/nyheter/rf-sisu",
  "/sv/nyheter/some-filmer-foer-granngardens-nya-tjaenst-grannhjaelpen",
  "/sv/nyheter/varfoer-driva-en-reklambyra-och-ha-kollektivavtal",
  "/sv/nyheter/varmt-vaelkommen-katri-",
  "/sv/nyheter/vi-har-fatt-en-alex-",
  "/sv/nyheter/vi-vaelkomnar-numera-maessor-till-baesta-kompisar",
];

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = `${OUTPUT_ROOT}/${timestamp}`;

function absoluteUrl(input) {
  return new URL(input, BASE_URL).toString();
}

function sameHost(url) {
  return new URL(url).host === new URL(BASE_URL).host;
}

function uniq(values) {
  return [...new Set(values)];
}

function textBetween(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeEntities(stripTags(match[1]).trim()) : "";
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractLinks(html, pageUrl) {
  return uniq(
    [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((href) => href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:"))
      .map((href) => new URL(href, pageUrl).toString())
      .filter(sameHost)
      .map((url) => new URL(url).pathname),
  );
}

function extractSeo(html) {
  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] || "";
  const robots = html.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1] || "";
  const description = html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || "";
  const lang = html.match(/<html\b[^>]*lang=["']([^"']+)["']/i)?.[1] || "";
  const hreflang = [...html.matchAll(/<link\b[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi)]
    .map((match) => ({ lang: match[1], href: match[2] }));
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => decodeEntities(stripTags(match[1]).trim()));
  const bodyText = textBetween(html, /<body\b[^>]*>([\s\S]*?)<\/body>/i);

  return {
    title: textBetween(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i),
    description,
    canonical,
    robots,
    lang,
    hreflang,
    h1Count: h1.length,
    h1,
    bodyTextLength: bodyText.length,
  };
}

async function fetchWithRedirects(url, maxRedirects = 10) {
  const chain = [];
  let current = url;
  const started = performance.now();

  for (let i = 0; i <= maxRedirects; i += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "bk-seo-baseline/1.0" },
    });
    chain.push({ url: current, status: response.status });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      const html = (response.headers.get("content-type") || "").includes("text/html")
        ? await response.text()
        : "";
      return {
        url,
        finalUrl: current,
        status: response.status,
        ok: response.ok,
        redirectChain: chain,
        redirectCount: chain.length - 1,
        ttfbMs: Math.round(performance.now() - started),
        seo: html ? extractSeo(html) : null,
        html,
      };
    }

    const location = response.headers.get("location");
    if (!location) break;
    current = new URL(location, current).toString();
  }

  return {
    url,
    finalUrl: current,
    status: 0,
    ok: false,
    redirectChain: chain,
    redirectCount: chain.length - 1,
    ttfbMs: Math.round(performance.now() - started),
    seo: null,
    html: "",
    error: "redirect loop or missing location",
  };
}

async function readSitemap() {
  const sitemapUrl = absoluteUrl("/sitemap.xml");
  const response = await fetch(sitemapUrl, { headers: { "user-agent": "bk-seo-baseline/1.0" } });
  if (!response.ok) return [];
  const xml = await response.text();
  return uniq([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname));
}

async function discoverHubLinks() {
  const links = [];
  for (const path of HUB_PATHS) {
    const result = await fetchWithRedirects(absoluteUrl(path));
    links.push(path);
    if (result.html) links.push(...extractLinks(result.html, absoluteUrl(path)));
  }
  return uniq(links).slice(0, MAX_HUB_LINKS);
}

function toCsv(rows) {
  const headers = [
    "url",
    "status",
    "finalUrl",
    "redirectCount",
    "ttfbMs",
    "title",
    "description",
    "canonical",
    "robots",
    "lang",
    "h1Count",
    "bodyTextLength",
  ];
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const sitemapPaths = await readSitemap();
  const hubLinks = await discoverHubLinks();
  const paths = uniq([...HUB_PATHS, ...sitemapPaths, ...hubLinks, ...CONTROL_PATHS]);

  const results = [];
  for (const path of paths) {
    const result = await fetchWithRedirects(absoluteUrl(path));
    results.push({
      sourcePath: path,
      url: result.url,
      status: result.status,
      finalUrl: result.finalUrl,
      redirectCount: result.redirectCount,
      ttfbMs: result.ttfbMs,
      title: result.seo?.title || "",
      description: result.seo?.description || "",
      canonical: result.seo?.canonical || "",
      robots: result.seo?.robots || "",
      lang: result.seo?.lang || "",
      h1Count: result.seo?.h1Count ?? "",
      bodyTextLength: result.seo?.bodyTextLength ?? "",
      hreflang: result.seo?.hreflang || [],
      h1: result.seo?.h1 || [],
      redirectChain: result.redirectChain,
      error: result.error || "",
    });
  }

  const failures = results.filter((row) => row.status >= 400 || row.status === 0);
  const redirects = results.filter((row) => row.redirectCount > 1);
  const noCanonical = results.filter((row) => row.status === 200 && !row.canonical);
  const h1Problems = results.filter((row) => row.status === 200 && row.h1Count !== 1);

  const summary = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    counts: {
      total: results.length,
      failures: failures.length,
      multiStepRedirects: redirects.length,
      missingCanonical: noCanonical.length,
      h1Problems: h1Problems.length,
    },
    failures: failures.map((row) => ({ url: row.url, status: row.status, finalUrl: row.finalUrl })),
    multiStepRedirects: redirects.map((row) => ({ url: row.url, redirectCount: row.redirectCount, chain: row.redirectChain })),
    missingCanonical: noCanonical.map((row) => row.url),
    h1Problems: h1Problems.map((row) => ({ url: row.url, h1Count: row.h1Count })),
  };

  await writeFile(`${outputDir}/baseline.json`, JSON.stringify({ summary, results }, null, 2));
  await writeFile(`${outputDir}/baseline.csv`, toCsv(results));
  await writeFile(`${outputDir}/summary.json`, JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0 || redirects.length > 0 || noCanonical.length > 0 || h1Problems.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

