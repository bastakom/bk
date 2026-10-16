/**
 * Röktest för datafilter (dashboard- och widgetnivå) mot ett produktionsbygge (port 3100).
 * Skapar en tillfällig dashboard för Demo Tandvård (demodata) och tar bort den efteråt.
 * Kräver `pnpm --filter web build`.  node scripts/e2e-filters.mjs [--shots <katalog>]
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
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

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;

// Tillfällig dashboard: Spend (Google Ads + LinkedIn) och en tabell per kampanj.
const [client] = await q(`SELECT id, "workspaceId" FROM clients WHERE slug = 'demo-tandvard'`);
const accounts = await q(`SELECT id FROM connected_accounts WHERE "clientId" = $1 AND "connectorId" IN ('mock_google_ads', 'mock_linkedin_ads')`, [client.id]);
if (accounts.length < 2) throw new Error("Demo Tandvård saknar demokonton för Google Ads och LinkedIn (kör seed).");
const dashboardId = `e2e-filter-${randomUUID()}`;
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'E2E filter', '{}', now())`, [dashboardId, client.workspaceId, client.id]);
const widget = async (type, title, cfg, layout) => {
  const id = randomUUID();
  await q(`INSERT INTO widgets (id, "workspaceId", "clientId", "dashboardId", type, title, config, layout, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`, [
    id, client.workspaceId, client.id, dashboardId, type, title, JSON.stringify(cfg), JSON.stringify(layout),
  ]);
  for (const a of accounts) await q(`INSERT INTO widget_sources ("workspaceId", "clientId", "widgetId", "accountId") VALUES ($1, $2, $3, $4)`, [client.workspaceId, client.id, id, a.id]);
};
await widget("kpi", "Spend", { metrics: ["spend"] }, { x: 0, y: 0, w: 3, h: 5 });
await widget("table", "Kampanjer", { metrics: ["spend"], dimension: "campaign", limit: 20 }, { x: 3, y: 0, w: 9, h: 10 });

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${base}/clients/demo-tandvard/dashboards/${dashboardId}`);
  await page.waitForSelector(".react-grid-layout");
  const spendCard = page.getByRole("region", { name: "Spend" }).first();
  const spend = async () => (await spendCard.locator("p").first().textContent()).trim();
  const before = await spend();

  // Dashboardfilter: LinkedIn, en enda kampanj.
  await page.getByRole("button", { name: /^Filter/ }).click();
  await page.getByRole("button", { name: "Lägg till filter" }).click();
  await page.getByRole("combobox", { name: "Kanal" }).click();
  await page.getByRole("option", { name: /LinkedIn Ads/ }).click();
  await page.getByRole("button", { name: /Välj kampanj/ }).click();
  const option = page.getByRole("option").filter({ hasNotText: "Lägg till" }).first();
  await option.waitFor();
  const campaign = (await option.textContent()).trim();
  ok(campaign.length > 0, `Kundens LinkedIn-kampanjer listas (${campaign} …)`);
  await option.click();
  await page.keyboard.press("Escape");
  await shot(page, "filter-dialog");
  await page.getByRole("button", { name: "Spara filter" }).click();
  await page.getByRole("list", { name: "Aktiva filter för dashboarden" }).waitFor();
  await page.waitForFunction((b) => document.querySelector('[aria-label="Spend"] p')?.textContent?.trim() !== b, before, { timeout: 30_000 }).catch(() => {});
  const after = await spend();
  const num = (s) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));
  ok(num(after) < num(before) && num(after) > 0, `Spend räknas om med filtret (${before} → ${after})`);
  ok((await spendCard.getByLabel(/^Filtrerad:/).count()) === 1, "Widgeten visar att den är filtrerad");
  const table = page.getByRole("region", { name: "Kampanjer" });
  ok((await table.locator("tbody tr").filter({ hasText: campaign }).count()) === 1, "Tabellen per kampanj visar den valda LinkedIn-kampanjen");
  // Bara den valda kampanjen har kvar LinkedIn som källa; Google Ads-raderna påverkas inte.
  const linkedInRows = await table.locator("tbody tr").filter({ has: page.getByRole("img", { name: "LinkedIn Ads" }) }).allTextContents();
  const googleRows = await table.locator("tbody tr").filter({ has: page.getByRole("img", { name: "Google Ads" }) }).count();
  ok(linkedInRows.length === 1 && linkedInRows[0].includes(campaign) && googleRows > 1, `LinkedIn bara för vald kampanj, Google Ads ofiltrerat (${googleRows} rader)`);
  await shot(page, "filter-aktivt");

  // Filtret gäller även delad länk/PDF: utskriftsvyn läser samma inställningar.
  await page.reload();
  ok((await spend()) === after, "Filtret är sparat på dashboarden");

  await page.getByRole("button", { name: /Ta bort filtret/ }).click();
  await page.waitForFunction((a) => document.querySelector('[aria-label="Spend"] p')?.textContent?.trim() !== a, after, { timeout: 30_000 });
  ok((await spend()) === before, "Utan filter visas ursprungliga värden igen");
  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`DELETE FROM dashboards WHERE id = $1`, [dashboardId]);
  await db.end();
}
