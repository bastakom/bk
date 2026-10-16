/**
 * Röktest för kartwidget, CSV-export och bild-/videowidget mot ett produktionsbygge (port 3100).
 * Tillfällig kund som väljer en synkad GA4-källa och tas bort efteråt.
 *   node scripts/e2e-widgets-extra.mjs [--shots <katalog>]
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";
import { startTestServer, TEST_BASE } from "./lib/test-server.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
config({ path: `${root}.env`, quiet: true });
const base = TEST_BASE;
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const shot = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FEL: ${msg}`);
  console.log(`✓ ${msg}`);
};
// 8×8 px PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGP4n5CEFTEMLQkAA5xwQZFLxAIAAAAASUVORK5CYII=", "base64");

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const [src] = await q(`SELECT a.id, a."workspaceId", a.platform FROM connected_accounts a WHERE a."lastSyncedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM metric_facts f WHERE f."accountId" = a.id AND f.dimension = 'country') LIMIT 1`);
if (!src) throw new Error("Behöver en synkad källa med uppdelning per land.");
const metric = src.platform === "ga4" ? "sessions" : "impressions";
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-extra-${Date.now()}`;
const dashboardId = `e2e-${randomUUID()}`;
await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, 'E2E widgets', $3, now())`, [clientId, src.workspaceId, slug]);
await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [src.workspaceId, clientId, src.id]);
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'Widgettest', '{"range":{"preset":"last_90"}}', now())`, [dashboardId, src.workspaceId, clientId]);
const wid = randomUUID();
await q(`INSERT INTO widgets (id, "workspaceId", "clientId", "dashboardId", type, title, config, layout, "updatedAt") VALUES ($1, $2, $3, $4, 'map', 'Länder', $5, '{"x":0,"y":0,"w":8,"h":12}', now())`, [
  wid, src.workspaceId, clientId, dashboardId, JSON.stringify({ metrics: [metric], dimension: "country", sourcePlatforms: [src.platform] }),
]);
await q(`INSERT INTO widget_sources ("workspaceId", "clientId", "widgetId", "accountId") VALUES ($1, $2, $3, $4)`, [src.workspaceId, clientId, wid, src.id]);

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2, acceptDownloads: true });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/clients/${slug}/dashboards/${dashboardId}`);
  const map = page.getByRole("region", { name: "Länder" });

  // 1. Karta
  await map.getByRole("img", { name: /per land på karta/ }).waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => document.querySelectorAll('[aria-label*="per land på karta"] path').length > 100, null, { timeout: 30_000 });
  ok(true, "Världskartan ritas");
  const top = await map.getByRole("list", { name: "Största länderna" }).getByRole("listitem").allInnerTexts();
  ok(top.length > 0 && top.some((t) => t.includes("Sverige")), `Största länderna med svenska namn (${top[0]?.split("\n")[0]} …)`);
  await shot(page, "karta");

  // 2. CSV
  await map.hover();
  const [dl] = await Promise.all([page.waitForEvent("download"), map.getByRole("button", { name: /som CSV/ }).click()]);
  const csv = await readFile(await dl.path(), "utf8");
  ok(dl.suggestedFilename() === "Länder.csv", "CSV-fil med widgetens namn");
  ok(csv.startsWith("﻿") && csv.split("\r\n")[0].startsWith("﻿Land;"), "UTF-8 med BOM och semikolon (öppnas rätt i Excel)");
  ok(/\r\n(Sweden|SE);\d/.test(csv), "Raderna har värden per land");

  // 3. Bild och video
  await page.getByRole("button", { name: "Redigera" }).click();
  const addMedia = async (fill) => {
    await page.getByRole("button", { name: "Lägg till widget" }).click();
    const editor = page.getByRole("dialog");
    await editor.getByRole("button", { name: "Bild eller video", exact: true }).click();
    await fill(editor);
    await editor.getByRole("button", { name: /Lägg till|Spara/ }).last().click();
    await editor.waitFor({ state: "detached" });
  };
  await addMedia(async (editor) => {
    await editor.getByLabel("Bild", { exact: true }).setInputFiles({ name: "koncept.png", mimeType: "image/png", buffer: PNG });
    await editor.getByLabel("Bildtext (valfri)").fill("Kampanjkoncept");
    await editor.getByText("Kampanjkoncept").first().waitFor();
  });
  ok(await page.locator('figure img[src^="data:image/png"]').waitFor({ timeout: 30_000 }).then(() => true, () => false), "Uppladdad bild visas i rapporten");
  await addMedia(async (editor) => {
    await editor.getByRole("button", { name: "Video", exact: true }).click();
    await editor.getByLabel("Länk till video").fill("https://evil.example/video");
    ok(await editor.getByText("Bara YouTube- och Vimeo-länkar kan bäddas in.").isVisible(), "Andra videoadresser godtas inte");
    await editor.getByLabel("Länk till video").fill("https://youtu.be/dQw4w9WgXcQ");
  });
  ok(await page.locator('iframe[src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]').waitFor({ timeout: 30_000 }).then(() => true, () => false), "YouTube-video bäddas in (utan spårningskakor)");
  await shot(page, "media");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await db.end();
}
