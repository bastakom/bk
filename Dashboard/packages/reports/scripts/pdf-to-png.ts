/**
 * Renderar PDF-sidor till PNG för visuell granskning:
 *   pnpm --filter @rp/reports pdf2png <fil.pdf> <utkatalog> [sidor, t.ex. 1-3] [skala]
 */
import { createCanvas } from "@napi-rs/canvas";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const [file, outDir = ".", pagesArg, scaleArg] = process.argv.slice(2);
if (!file) throw new Error("Ange en PDF-fil");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data: new Uint8Array(await readFile(file)) }).promise;
const [from, to] = pagesArg ? pagesArg.split("-").map(Number) : [1, doc.numPages];
const scale = Number(scaleArg ?? 1.5);
await mkdir(outDir, { recursive: true });
for (let i = from!; i <= Math.min(to ?? from!, doc.numPages); i++) {
  const page = await doc.getPage(i);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvas: canvas as any, viewport: vp }).promise;
  const out = join(outDir, `${basename(file, ".pdf")}-${i}.png`);
  await writeFile(out, canvas.toBuffer("image/png"));
  console.log(out);
}
