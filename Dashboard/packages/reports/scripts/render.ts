/**
 * Renderar en dashboard till PDF från kommandoraden (kräver `pnpm dev`).
 *   pnpm --filter @rp/reports render "<dashboardnamn>" [paged|long] [utfil.pdf] [range]
 */
import { config } from "dotenv";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const { createOwnerClient } = await import("@rp/db");
const { renderDashboardPdf, closeBrowser } = await import("../src/index");

const [name = "Årsrapport", layout = "paged", out = `rapport-${layout}.pdf`, range] = process.argv.slice(2);
const prisma = createOwnerClient();
const d = await prisma.dashboard.findFirstOrThrow({ where: { name }, orderBy: { createdAt: "desc" } });
console.time("render");
const res = await renderDashboardPdf({
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET!,
  workspaceId: d.workspaceId,
  dashboardId: d.id,
  layout: layout === "long" ? "long" : "paged",
  query: range ? { range } : {},
});
console.timeEnd("render");
await writeFile(out, res.pdf);
console.log(`${out}: ${res.pages} sidor, ${Math.round(res.pdf.length / 1024)} kB. Sektioner: ${res.sections.map((s) => `${s.title} s.${s.page}`).join(", ")}`);
await closeBrowser();
await prisma.$disconnect();
