/**
 * PDF-export av en dashboard med Playwright (headless Chromium).
 *
 * Paginerad A4:
 *  1. Innehållet renderas från utskriftsvyn med Chromes egen sidbrytning
 *     (band, diagram och tabellrader delas aldrig) och sidfot med sidnummer.
 *  2. Texten i PDF:en läses för att hitta på vilken sida varje sektion hamnade.
 *  3. Omslag och innehållsförteckning renderas med de sidnumren och läggs först.
 *
 * En lång sida: allt på en enda sida, som exempelrapporten men utan att klippa.
 */
import { PDFDocument } from "pdf-lib";
import { chromium, type Browser } from "playwright";
import { signPrintToken } from "@rp/core/server";

export type PdfLayout = "paged" | "long";

export interface RenderOptions {
  baseUrl: string;
  secret: string;
  workspaceId: string;
  dashboardId: string;
  layout: PdfLayout;
  /** range, compare, from, to – samma parametrar som dashboarden */
  query?: Record<string, string | undefined>;
}

export interface RenderedPdf {
  pdf: Buffer;
  pages: number;
  title: string;
  sections: { title: string; page: number }[];
}

/** A4 minus marginaler (12 mm) i CSS-pixlar vid 96 dpi. */
const A4_PRINTABLE_WIDTH_PX = ((210 - 24) / 25.4) * 96;
const PAGED_WIDTH = 880;
const LONG_WIDTH = 1200;
/** PDF:s maximala sidstorlek är 200 tum. */
const MAX_PAGE_PX = 200 * 96 - 100;

declare global {
  interface Window {
    __printReady?: boolean;
    __printMeta?: { sections: string[]; footer: string; lang?: string };
  }
}

const g = globalThis as unknown as { __rpBrowser?: Promise<Browser> };

/** Återanvänd en webbläsare mellan exporter; starta om om den kraschat. */
async function getBrowser(): Promise<Browser> {
  if (g.__rpBrowser) {
    const b = await g.__rpBrowser.catch(() => null);
    if (b?.isConnected()) return b;
  }
  g.__rpBrowser = chromium.launch({ args: ["--font-render-hinting=none"] });
  return g.__rpBrowser;
}

export async function closeBrowser() {
  const b = await g.__rpBrowser?.catch(() => null);
  g.__rpBrowser = undefined;
  await b?.close();
}

function printUrl(opts: RenderOptions, extra: Record<string, string>) {
  const token = signPrintToken({ d: opts.dashboardId, w: opts.workspaceId }, opts.secret);
  const q = new URLSearchParams({ token, layout: opts.layout, ...extra });
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v) q.set(k, v);
  return `${opts.baseUrl}/print/${opts.dashboardId}?${q}`;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function renderDashboardPdf(opts: RenderOptions): Promise<RenderedPdf> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: opts.layout === "long" ? LONG_WIDTH + 80 : PAGED_WIDTH, height: 1200 },
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "sv-SE",
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const open = async (url: string) => {
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      if (!res || res.status() >= 400) throw new Error(`Utskriftsvyn svarade ${res?.status() ?? "inget svar"}`);
      await page.waitForFunction(() => window.__printReady === true, null, { timeout: 60_000 });
      if (errors.length) throw new Error(`Fel i utskriftsvyn: ${errors[0]}`);
    };

    // Mätpass med osynliga markörer för sektionernas sidnummer (bara paginerat läge).
    await open(printUrl(opts, { part: "content", markers: opts.layout === "paged" ? "1" : "0" }));
    const meta = await page.evaluate(() => window.__printMeta!);
    const title = await page.title();

    if (opts.layout === "long") {
      await page.addStyleTag({ content: "body { padding: 40px; }" });
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const scale = Math.min(1, MAX_PAGE_PX / height);
      const pdf = await page.pdf({
        width: `${Math.ceil((LONG_WIDTH + 80) * scale)}px`,
        height: `${Math.ceil(height * scale) + 2}px`,
        scale,
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
        pageRanges: "1",
      });
      return { pdf: Buffer.from(pdf), pages: 1, title, sections: [] };
    }

    // 1. Innehåll med sidfot
    const footer = `
      <div style="width:100%;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:7.5px;color:#6b6a66;padding:0 12mm;display:flex;justify-content:space-between;">
        <span>${escapeHtml(meta.footer)}</span>
        <span>${meta.lang === "en" ? "Page" : "Sida"} <span class="pageNumber"></span> ${meta.lang === "en" ? "of" : "av"} <span class="totalPages"></span></span>
      </div>`;
    const contentOptions = {
      format: "A4" as const,
      printBackground: true,
      scale: Math.min(1, A4_PRINTABLE_WIDTH_PX / PAGED_WIDTH),
      margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
    };
    const measured = await page.pdf(contentOptions);

    // 2. Var hamnade sektionerna? Rendera sedan om utan markörer så att de inte finns i PDF:ens text.
    const markerPages = await findMarkers(measured);
    await open(printUrl(opts, { part: "content", markers: "0" }));
    const content = await page.pdf(contentOptions);
    const sections = meta.sections.map((t, i) => ({ title: t, page: markerPages.get(i) ?? 0 })).filter((s) => s.page > 0);
    const contentDoc = await PDFDocument.load(content);
    if (contentDoc.getPageCount() !== (await PDFDocument.load(measured)).getPageCount()) {
      throw new Error("Sidbrytningen skilde sig mellan mätpass och slutlig rendering");
    }
    const showToc = contentDoc.getPageCount() > 1 && sections.length > 1;

    // 3. Omslag (+ innehållsförteckning)
    await page.setViewportSize({ width: 794, height: 1123 });
    await open(printUrl(opts, { part: "cover", ...(showToc ? { toc: Buffer.from(JSON.stringify(sections)).toString("base64url") } : {}) }));
    const cover = await page.pdf({ width: "210mm", height: "297mm", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });

    // 4. Slå ihop
    const out = await PDFDocument.create();
    out.setTitle(title.replace(/ · Rapportplattform$/, ""));
    out.setCreator("Rapportplattform");
    out.setProducer("Rapportplattform (Chromium)");
    const coverDoc = await PDFDocument.load(cover);
    for (const p of await out.copyPages(coverDoc, coverDoc.getPageIndices())) out.addPage(p);
    for (const p of await out.copyPages(contentDoc, contentDoc.getPageIndices())) out.addPage(p);
    const bytes = await out.save();
    return { pdf: Buffer.from(bytes), pages: out.getPageCount(), title, sections };
  } finally {
    await context.close();
  }
}

/** Läser PDF:ens text och returnerar sektionsindex → sidnummer (1-baserat). */
export async function findMarkers(pdf: Uint8Array): Promise<Map<number, number>> {
  const text = await pdfText(pdf);
  const out = new Map<number, number>();
  text.forEach((t, i) => {
    for (const m of t.matchAll(/@@S(\d+)@@/g)) {
      const idx = Number(m[1]);
      if (!out.has(idx)) out.set(idx, i + 1);
    }
  });
  return out;
}

/** Text per sida (för markörer och tester). */
export async function pdfText(pdf: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " "));
  }
  await task.destroy();
  return pages;
}

/** "Demo-Finans-Arsrapport-2025-01-01_2025-12-31.pdf" */
export function pdfFilename(client: string, dashboard: string, range: { start: string; end: string }) {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  return `${clean(client)}-${clean(dashboard)}-${range.start}_${range.end}.pdf`;
}
