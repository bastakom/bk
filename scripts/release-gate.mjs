#!/usr/bin/env node

/*
  Release gate for internal URLs.
  Copy to: scripts/release-gate.mjs

  Purpose:
  - Crawl important public hub pages.
  - Extract same-host internal links.
  - Fail the release if any discovered internal URL ends in 4xx/5xx.
  - Fail if any discovered internal URL needs more than one redirect.

  No third-party dependencies. Requires Node 18+.
*/

const BASE_URL = process.env.RELEASE_GATE_BASE_URL || process.env.SEO_BASE_URL || "https://bastakompisar.se";
const MAX_LINKS = Number(process.env.RELEASE_GATE_MAX_LINKS || 400);

const SEED_PATHS = [
  "/sv",
  "/sv/cases",
  "/sv/nyheter",
  "/sv/marknadsfika",
  "/sv/filmproduktion",
  "/sv/vara-tjanster",
  "/sv/omoss",
];

const SKIP_EXTENSIONS = [
  ".avif",
  ".css",
  ".gif",
  ".ico",
  ".jpg",
  ".jpeg",
  ".js",
  ".json",
  ".map",
  ".mp4",
  ".pdf",
  ".png",
  ".svg",
  ".webm",
  ".webp",
  ".xml",
];

function absoluteUrl(input) {
  return new URL(input, BASE_URL).toString();
}

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return `/${pathname.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function sameHost(url) {
  return new URL(url).host === new URL(BASE_URL).host;
}

function shouldSkipPath(pathname) {
  const lower = pathname.toLowerCase();
  return (
    lower.startsWith("/api/") ||
    lower.startsWith("/_next/") ||
    lower.startsWith("/img/") ||
    SKIP_EXTENSIONS.some((extension) => lower.endsWith(extension))
  );
}

function uniq(values) {
  return [...new Set(values)];
}

function extractInternalLinks(html, pageUrl) {
  return uniq(
    [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((href) => href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:"))
      .map((href) => new URL(href, pageUrl).toString())
      .filter(sameHost)
      .map((url) => normalizePath(new URL(url).pathname))
      .filter((pathname) => !shouldSkipPath(pathname)),
  );
}

async function fetchWithRedirects(url, maxRedirects = 10) {
  const chain = [];
  let current = url;

  for (let i = 0; i <= maxRedirects; i += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "bk-release-gate/1.0" },
    });

    chain.push({ url: current, status: response.status });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      const contentType = response.headers.get("content-type") || "";
      const html = contentType.includes("text/html") ? await response.text() : "";

      return {
        url,
        finalUrl: current,
        status: response.status,
        redirectCount: chain.length - 1,
        redirectChain: chain,
        html,
      };
    }

    const location = response.headers.get("location");
    if (!location) {
      return {
        url,
        finalUrl: current,
        status: 0,
        redirectCount: chain.length - 1,
        redirectChain: chain,
        html: "",
        error: "Redirect response without location header",
      };
    }

    current = new URL(location, current).toString();
  }

  return {
    url,
    finalUrl: current,
    status: 0,
    redirectCount: chain.length - 1,
    redirectChain: chain,
    html: "",
    error: "Redirect loop or too many redirects",
  };
}

async function main() {
  const discovered = new Set(SEED_PATHS.map(normalizePath));
  const seedResults = [];

  for (const path of SEED_PATHS) {
    const result = await fetchWithRedirects(absoluteUrl(path));
    seedResults.push(result);

    if (result.html) {
      for (const link of extractInternalLinks(result.html, absoluteUrl(path))) {
        discovered.add(link);
      }
    }
  }

  const paths = [...discovered].slice(0, MAX_LINKS);
  const checked = [];

  for (const path of paths) {
    checked.push(await fetchWithRedirects(absoluteUrl(path)));
  }

  const broken = checked.filter((result) => result.status >= 400 || result.status === 0);
  const multiStepRedirects = checked.filter((result) => result.redirectCount > 1);

  const summary = {
    baseUrl: BASE_URL,
    checkedAt: new Date().toISOString(),
    counts: {
      seeds: SEED_PATHS.length,
      checked: checked.length,
      broken: broken.length,
      multiStepRedirects: multiStepRedirects.length,
    },
    broken: broken.map((result) => ({
      url: result.url,
      status: result.status,
      finalUrl: result.finalUrl,
      error: result.error || "",
    })),
    multiStepRedirects: multiStepRedirects.map((result) => ({
      url: result.url,
      redirectCount: result.redirectCount,
      chain: result.redirectChain,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (broken.length > 0 || multiStepRedirects.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

