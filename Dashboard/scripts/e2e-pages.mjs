/**
 * Röktest för sidor (flikar), presentationsläge, PDF per sida och delad länk med flikar,
 * mot ett produktionsbygge (port 3100). Använder en tillfällig kund som tas bort efteråt.
 *   node scripts/e2e-pages.mjs [--shots <katalog>]
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
const [src] = await q(`SELECT id, "workspaceId", platform FROM connected_accounts WHERE "lastSyncedAt" IS NOT NULL LIMIT 1`);
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-sidor-${Date.now()}`;
const dashboardId = `e2e-${randomUUID()}`;
await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, 'E2E sidor', $3, now())`, [clientId, src.workspaceId, slug]);
await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [src.workspaceId, clientId, src.id]);
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'Sidtest', '{}', now())`, [dashboardId, src.workspaceId, clientId]);
const widget = async (type, title, cfg, layout, accountIds = []) => {
  const id = randomUUID();
  await q(`INSERT INTO widgets (id, "workspaceId", "clientId", "dashboardId", type, title, config, layout, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`, [
    id, src.workspaceId, clientId, dashboardId, type, title, JSON.stringify(cfg), JSON.stringify(layout),
  ]);
  for (const a of accountIds) await q(`INSERT INTO widget_sources ("workspaceId", "clientId", "widgetId", "accountId") VALUES ($1, $2, $3, $4)`, [src.workspaceId, clientId, id, a]);
  return id;
};
const kpiId = await widget("kpi", "Spend", { metrics: ["spend"], sourcePlatforms: [src.platform] }, { x: 0, y: 0, w: 3, h: 5 }, [src.id]);
await widget("text", "Inledning", { text: "Översikt" }, { x: 3, y: 0, w: 9, h: 3 });

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, acceptDownloads: true });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const url = `${base}/clients/${slug}/dashboards/${dashboardId}`;
  await page.goto(url);
  await page.waitForSelector(".react-grid-layout");
  ok((await page.getByRole("tablist", { name: "Sidor" }).count()) === 0, "En dashboard med en sida visar inga flikar");

  // 1. Ny sida
  await page.getByRole("button", { name: "Redigera" }).click();
  await page.getByRole("button", { name: "Ny sida" }).click();
  await page.getByLabel("Sidans namn").fill("Meta");
  await page.getByLabel("Sidans namn").press("Enter");
  await page.getByRole("tab", { name: /^Meta/ }).waitFor();
  await page.waitForURL(/page=/);
  ok(await page.getByRole("tab", { name: /^Meta/ }).getAttribute("aria-selected") === "true", "Ny sida skapas och väljs (sidan står i URL:en)");
  const pageId = new URL(page.url()).searchParams.get("page");

  // 2. Flytta en widget till sidan
  await page.getByRole("tab", { name: /^Översikt/ }).click();
  await page.getByRole("checkbox", { name: "Markera Spend" }).check();
  await page.getByRole("button", { name: "Flytta till sida" }).click();
  await page.getByRole("menuitem", { name: "Meta" }).click();
  await page.getByText(/widgets är flyttade/).waitFor({ timeout: 30_000 });
  const moved = await q(`SELECT config->>'pageId' p FROM widgets WHERE id = $1`, [kpiId]);
  ok(moved[0].p === pageId, "Widgeten flyttades till sidan");
  await page.getByRole("tab", { name: /^Meta/ }).click();
  ok(await page.getByRole("region", { name: "Spend" }).waitFor({ timeout: 15_000 }).then(() => true, () => false), "Fliken visar sidans widgets");

  // 3. Byt namn och lägg till widget på sidan
  await page.getByRole("button", { name: "Fler val för sidan Meta" }).click();
  await page.getByRole("menuitem", { name: "Byt namn" }).click();
  await page.getByLabel("Sidans namn").fill("Meta Ads");
  await page.getByLabel("Sidans namn").press("Enter");
  await page.getByRole("tab", { name: /^Meta Ads/ }).waitFor();
  await page.getByRole("button", { name: "Lägg till widget" }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("button", { name: "Text", exact: true }).click();
  await editor.getByLabel("Text", { exact: true }).fill("Kommentar om Meta");
  await editor.getByRole("button", { name: /Lägg till|Spara/ }).last().click();
  await editor.waitFor({ state: "detached" });
  await page.getByText("Kommentar om Meta").waitFor();
  const added = await q(`SELECT config->>'pageId' p FROM widgets WHERE "dashboardId" = $1 AND config->>'text' = 'Kommentar om Meta'`, [dashboardId]);
  ok(added[0]?.p === pageId, "Ny widget hamnar på aktiv sida");
  await shot(page, "sidor-redigera");
  await page.getByRole("button", { name: "Klar" }).click();

  // 4. Presentationsläge
  await page.getByRole("tab", { name: /^Översikt/ }).click();
  await page.getByRole("button", { name: /Dela och exportera/ }).click();
  await page.getByRole("menuitem", { name: /Presentera/ }).click();
  const show = page.getByRole("dialog", { name: "Presentation" });
  ok(await show.getByText("1 / 2").waitFor().then(() => true), "Presentationen startar på aktuell sida (1 / 2)");
  await page.keyboard.press("ArrowRight");
  await show.getByText("2 / 2").waitFor();
  ok(await show.getByText("Meta Ads").first().isVisible() && await show.getByText("Kommentar om Meta").isVisible(), "Piltangent byter sida");
  await shot(page, "presentation");
  await page.keyboard.press("Escape");
  await show.waitFor({ state: "detached" });
  ok(true, "Esc avslutar presentationen");

  // 5. PDF med sidorna efter varandra
  const pdf = await ctx.request.get(`${base}/api/dashboards/${dashboardId}/pdf?layout=paged`, { timeout: 180_000 });
  ok(pdf.ok() && pdf.headers()["content-type"]?.includes("pdf"), "PDF skapas för dashboard med flera sidor");

  // 6. Delad länk med flikar
  await page.getByRole("button", { name: /Dela och exportera/ }).click();
  await page.getByRole("menuitem", { name: /Dela länk med kunden/ }).click();
  await page.getByLabel("Namn (för er)").fill("Sidtest");
  await page.getByRole("button", { name: "Skapa länk" }).click();
  const linkInput = page.getByLabel(/Länk Sidtest/);
  await linkInput.waitFor();
  const shareUrl = (await linkInput.inputValue()).replace(/^https?:\/\/[^/]+/, base);
  const guest = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.goto(shareUrl);
  await guest.getByRole("tab", { name: "Meta Ads" }).click();
  await guest.getByText("Kommentar om Meta").waitFor();
  ok(true, "Kunden ser flikarna och kan byta sida på den delade länken");
  ok((await guest.getByRole("button", { name: "Ny sida" }).count()) === 0, "Kunden kan inte ändra sidor");
  await page.keyboard.press("Escape");

  // 7. Ta bort sidan (med dess widgets)
  await page.goto(`${url}?page=${pageId}`);
  await page.getByRole("button", { name: "Redigera" }).click();
  await page.getByRole("button", { name: "Fler val för sidan Meta Ads" }).click();
  await page.getByRole("menuitem", { name: "Ta bort sidan" }).click();
  await page.getByRole("tablist", { name: "Sidor" }).getByRole("tab").first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"]').length === 1, null, { timeout: 30_000 });
  const left = await q(`SELECT count(*)::int n FROM widgets WHERE "dashboardId" = $1`, [dashboardId]);
  ok(left[0].n === 1, "Sidan och dess widgets togs bort");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await db.end();
}
