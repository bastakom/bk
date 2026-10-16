/**
 * Röktest för UX-rättningarna K1–K4 mot ett produktionsbygge (port 3100):
 *  - widgets utan källa döljs (med förklaring) och syns aldrig för kunden
 *  - borttagen widget går att ångra (knapp och ⌘Z)
 *  - svenska felsidor, och inga axe-fel på dashboarden
 * Tillfällig kund som tas bort efteråt.
 *   node scripts/e2e-ux-critical.mjs
 */
import { config } from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";
import { startTestServer, TEST_BASE } from "./lib/test-server.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
config({ path: `${root}.env`, quiet: true });
const base = TEST_BASE;
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FEL: ${msg}`);
  console.log(`✓ ${msg}`);
};
const require = createRequire(import.meta.url);
const axeSrc = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const [src] = await q(`SELECT a.id, a."workspaceId" FROM connected_accounts a WHERE a.platform = 'ga4' AND a."lastSyncedAt" IS NOT NULL LIMIT 1`);
if (!src) throw new Error("Behöver en synkad GA4-källa.");
const ws = src.workspaceId;
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-ux-${Date.now()}`;
const dashboardId = `e2e-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, 'E2E UX', $3, now())`, [clientId, ws, slug]);
await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [ws, clientId, src.id]);
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'UX-test', '{"range":{"preset":"last_30"}}', now())`, [dashboardId, ws, clientId]);
const mk = async (type, title, cfg, layout, withSource) => {
  const id = randomUUID();
  await q(`INSERT INTO widgets (id, "workspaceId", "clientId", "dashboardId", type, title, config, layout, "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`, [id, ws, clientId, dashboardId, type, title, JSON.stringify(cfg), JSON.stringify(layout)]);
  if (withSource) await q(`INSERT INTO widget_sources ("workspaceId", "clientId", "widgetId", "accountId") VALUES ($1,$2,$3,$4)`, [ws, clientId, id, src.id]);
  return id;
};
await mk("kpi", "Besök GA", { metrics: ["sessions"], sourcePlatforms: ["ga4"] }, { x: 0, y: 0, w: 4, h: 4 }, true);
await mk("section", "LinkedIn", { sourcePlatforms: ["linkedin_ads"] }, { x: 0, y: 4, w: 12, h: 2 }, false);
await mk("kpi", "Spend LinkedIn", { metrics: ["spend"], sourcePlatforms: ["linkedin_ads"] }, { x: 0, y: 6, w: 4, h: 4 }, false);
await mk("kpi", "Klick LinkedIn", { metrics: ["clicks"], sourcePlatforms: ["linkedin_ads"] }, { x: 4, y: 6, w: 4, h: 4 }, false);
await q(`INSERT INTO share_links (id, "workspaceId", "clientId", "dashboardId", token) VALUES ($1,$2,$3,$4,$5)`, [`e2e-${randomUUID()}`, ws, clientId, dashboardId, token]);

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const url = `${base}/clients/${slug}/dashboards/${dashboardId}`;
  await page.goto(url);

  // K2
  await page.getByRole("region", { name: "Besök GA" }).waitFor();
  ok(await page.getByText(/2 widgets visas inte eftersom kunden saknar källa för LinkedIn Ads \(2\)/).isVisible(), "Förklaring om dolda widgets utan källa");
  ok(!(await page.getByRole("region", { name: "Spend LinkedIn" }).count()) && !(await page.getByText("Välj minst en källa.").count()), "Tomma widgets och deras sektionsrubrik visas inte");
  await page.getByRole("button", { name: "Redigera" }).click();
  await page.getByRole("region", { name: "Spend LinkedIn" }).waitFor();
  ok(true, "I redigeringsläget syns de för att kunna åtgärdas");
  const shared = await (await browser.newContext()).newPage();
  await shared.goto(`${base}/s/${token}`);
  await shared.getByRole("region", { name: "Besök GA" }).waitFor();
  ok(!(await shared.getByText(/LinkedIn|Välj minst en källa|visas inte/).count()), "Kunden ser varken tomma widgets eller förklaringen");

  // K3
  const card = page.getByRole("region", { name: "Klick LinkedIn" });
  await card.hover();
  await card.getByRole("button", { name: "Ta bort widget" }).click();
  await card.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Ångra" }).click();
  await page.getByText("Widgeten är tillbaka.").waitFor();
  await page.getByRole("region", { name: "Klick LinkedIn" }).waitFor();
  ok(true, "Borttagen widget kommer tillbaka med Ångra");
  const again = page.getByRole("region", { name: "Klick LinkedIn" });
  await again.hover();
  await again.getByRole("button", { name: "Ta bort widget" }).click();
  await again.waitFor({ state: "detached" });
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ControlOrMeta+z");
  await page.getByRole("region", { name: "Klick LinkedIn" }).waitFor();
  const [{ n }] = await q(`SELECT count(*)::int n FROM widget_sources ws JOIN widgets w ON w.id = ws."widgetId" WHERE w."dashboardId" = $1`, [dashboardId]);
  ok(n === 1, "⌘Z ångrar också, och källkopplingar återskapas");

  // K4
  await page.getByRole("button", { name: "Klar" }).click();
  await page.getByRole("button", { name: "Redigera" }).waitFor();
  await page.waitForTimeout(400); // låt färgövergången bli klar innan kontrasten mäts
  await page.addScriptTag({ content: axeSrc });
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map((x) => `${x.id} (${x.nodes.length}): ${x.nodes.map((n) => n.target.join(" ") + " " + (n.failureSummary ?? "").split("\n")[1]).join("; ")}`));
  ok(v.length === 0, `Inga axe-fel på dashboarden${v.length ? `: ${v.join(", ")}` : ""}`);

  // K1
  await page.goto(`${base}/clients/finns-inte-${Date.now()}`);
  ok(await page.getByRole("heading", { name: "Sidan finns inte" }).isVisible(), "Svensk 404 inne i appen med väg tillbaka");
  await shared.goto(`${base}/s/ogiltig-token-som-inte-finns-alls-123`);
  ok(await shared.getByRole("heading", { name: "Sidan finns inte" }).isVisible(), "Svensk 404 för okänd delningslänk");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await db.end();
}
