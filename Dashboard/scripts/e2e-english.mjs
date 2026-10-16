/**
 * Röktest för rapporter på engelska mot ett produktionsbygge (port 3100).
 * Tillfällig kund med språket English och en delad länk; tas bort efteråt.
 *   node scripts/e2e-english.mjs [--shots <katalog>]
 */
import { config } from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";
import { startTestServer, TEST_BASE } from "./lib/test-server.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
config({ path: `${root}.env`, quiet: true });
const base = TEST_BASE;
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const shot = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FEL: ${msg}`);
  console.log(`✓ ${msg}`);
};

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const [src] = await q(`SELECT a.id, a."workspaceId", a.platform FROM connected_accounts a WHERE a.platform = 'ga4' AND a."lastSyncedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM metric_facts f WHERE f."accountId" = a.id) LIMIT 1`);
if (!src) throw new Error("Behöver en synkad GA4-källa.");
const ws = src.workspaceId;
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-english-${Date.now()}`;
const dashboardId = `e2e-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
await q(`INSERT INTO clients (id, "workspaceId", name, slug, locale, "updatedAt") VALUES ($1, $2, 'E2E English', $3, 'en-GB', now())`, [clientId, ws, slug]);
await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [ws, clientId, src.id]);
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'Monthly report', '{"range":{"preset":"last_90"}}', now())`, [dashboardId, ws, clientId]);
const widgets = [
  ["kpi", "Overview", { metrics: ["sessions", "engaged_sessions"], showComparison: true }, { x: 0, y: 0, w: 12, h: 4 }],
  ["timeseries", "Traffic", { metrics: ["sessions"], granularity: "month" }, { x: 0, y: 4, w: 12, h: 8 }],
];
for (const [type, title, cfg, layout] of widgets) {
  const id = randomUUID();
  await q(`INSERT INTO widgets (id, "workspaceId", "clientId", "dashboardId", type, title, config, layout, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`, [
    id, ws, clientId, dashboardId, type, title, JSON.stringify({ ...cfg, sourcePlatforms: ["ga4"] }), JSON.stringify(layout),
  ]);
  await q(`INSERT INTO widget_sources ("workspaceId", "clientId", "widgetId", "accountId") VALUES ($1, $2, $3, $4)`, [ws, clientId, id, src.id]);
}
await q(`INSERT INTO share_links (id, "workspaceId", "clientId", "dashboardId", token) VALUES ($1, $2, $3, $4, $5)`, [`e2e-${randomUUID()}`, ws, clientId, dashboardId, token]);

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: "sv-SE" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/s/${token}`);
  const kpi = page.getByRole("region", { name: "Overview" });
  await kpi.getByText("Sessions", { exact: true }).waitFor({ timeout: 30_000 });
  ok(true, "Nyckeltal har engelska namn (Sessions)");
  ok(await kpi.getByText("Engaged sessions", { exact: true }).isVisible(), "Engaged sessions");
  ok(!(await page.getByText("Besök", { exact: true }).count()), "Inga svenska nyckeltalsnamn");
  ok(await page.getByText("Last 90 days").first().isVisible(), "Perioden heter Last 90 days");
  const body = await page.locator("body").innerText();
  ok(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(body), "Datum med engelska månadsnamn");
  ok(!/\b(okt|maj|jämfört med|Jämförelse|totalt)\b/i.test(body), "Inga svenska ord i rapporten");
  const value = await kpi.locator(".tabular").first().innerText();
  ok(!/ /.test(value) && !/\d \d/.test(value), `Tal med engelsk formattering (${value.split("\n")[0]})`);
  ok((await page.locator("html").getAttribute("lang")) === "en", "Sidan har lang=en");
  await shot(page, "engelska");

  // PDF
  const pdf = await ctx.request.get(`${base}/s/${token}/pdf`);
  ok(pdf.ok() && (pdf.headers()["content-type"] ?? "").includes("pdf"), "PDF skapas för engelska rapporten");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await db.end();
}
