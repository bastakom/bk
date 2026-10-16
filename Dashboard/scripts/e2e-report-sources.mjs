/**
 * Röktest för "Rapportens källor" och markering av flera widgets, mot ett produktionsbygge (port 3100).
 * Skapar en tillfällig kund som väljer byråns befintliga källor (redan synkade, ingen ny synk)
 * och tar bort kunden efteråt. Befintliga kunder och dashboards påverkas inte.
 *   node scripts/e2e-report-sources.mjs [--shots <katalog>]
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

// Två synkade källor på samma kanal att byta mellan.
const sources = await q(`SELECT id, name, platform FROM connected_accounts WHERE "lastSyncedAt" IS NOT NULL AND platform = (SELECT platform FROM connected_accounts WHERE "lastSyncedAt" IS NOT NULL GROUP BY platform HAVING count(*) >= 2 LIMIT 1) ORDER BY name LIMIT 2`);
if (sources.length < 2 || sources[0].platform !== sources[1].platform) throw new Error("Behöver två synkade källor på samma kanal.");
const [a, b] = sources;
const [ws] = await q(`SELECT "workspaceId" id FROM connected_accounts WHERE id = $1`, [a.id]);
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-kallor-${Date.now()}`;
const dashboardId = `e2e-${randomUUID()}`;
await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, 'E2E källor', $3, now())`, [clientId, ws.id, slug]);
for (const s of sources) await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [ws.id, clientId, s.id]);
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'Källtest', '{}', now())`, [dashboardId, ws.id, clientId]);
const widget = async (type, title, cfg, layout, accountIds) => {
  const id = randomUUID();
  await q(`INSERT INTO widgets (id, "workspaceId", "clientId", "dashboardId", type, title, config, layout, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`, [
    id, ws.id, clientId, dashboardId, type, title, JSON.stringify(cfg), JSON.stringify(layout),
  ]);
  for (const acc of accountIds) await q(`INSERT INTO widget_sources ("workspaceId", "clientId", "widgetId", "accountId") VALUES ($1, $2, $3, $4)`, [ws.id, clientId, id, acc]);
  return id;
};
const P = [a.platform];
await widget("kpi", "Spend", { metrics: ["spend"], sourcePlatforms: P }, { x: 0, y: 0, w: 3, h: 5 }, [a.id]);
await widget("table", "Kampanjer", { metrics: ["spend"], dimension: "campaign", sourcePlatforms: P }, { x: 3, y: 0, w: 9, h: 8 }, [a.id]);
await widget("kpi", "Klick", { metrics: ["clicks"], sourcePlatforms: P }, { x: 0, y: 5, w: 3, h: 5 }, []); // har tappat sin källa
await widget("text", "Kommentar", { text: "Text" }, { x: 0, y: 10, w: 12, h: 3 }, []);
const sourcesOf = async () => (await q(`SELECT w.title, array_agg(ws."accountId") FILTER (WHERE ws."accountId" IS NOT NULL) ids FROM widgets w LEFT JOIN widget_sources ws ON ws."widgetId" = w.id WHERE w."dashboardId" = $1 GROUP BY w.title`, [dashboardId])).reduce((m, r) => ({ ...m, [r.title]: r.ids ?? [] }), {});

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/clients/${slug}/dashboards/${dashboardId}`);
  await page.waitForSelector(".react-grid-layout");

  // 1. Rapportens källor (finns i redigeringsläget)
  await page.getByRole("button", { name: "Redigera" }).click();
  await page.getByRole("button", { name: "Rapportens källor" }).click();
  const panel = page.getByRole("dialog", { name: "Rapportens källor" });
  ok(await panel.getByText("2 widgets", { exact: true }).isVisible(), `Panelen visar att ${a.name} används av 2 widgets`);
  ok(await panel.getByText(/1 widgets saknar .*-källa/).isVisible(), "Panelen visar widgeten som saknar källa");
  await shot(page, "rapportens-kallor");

  await panel.getByRole("combobox", { name: /Välj .*-källa för widgets som saknar källa/ }).click();
  await page.getByRole("option", { name: a.name }).click();
  await panel.getByText("3 widgets", { exact: true }).waitFor({ timeout: 30_000 });
  ok((await sourcesOf()).Klick?.includes(a.id), "Widgeten utan källa fick källan");

  await panel.getByRole("combobox", { name: `Byt ${a.name} i rapporten` }).click();
  await page.getByRole("option", { name: b.name }).click();
  await panel.getByRole("combobox", { name: `Byt ${b.name} i rapporten` }).waitFor({ timeout: 30_000 });
  const swapped = await sourcesOf();
  ok(["Spend", "Kampanjer", "Klick"].every((t) => swapped[t]?.length === 1 && swapped[t][0] === b.id), `Källan byttes i alla 3 widgets (${a.name} → ${b.name})`);
  ok(swapped.Kommentar.length === 0, "Textwidgeten påverkades inte");
  await page.keyboard.press("Escape");

  // 2. Ny widget utgår från rapportens källa
  await page.getByRole("button", { name: "Lägg till widget" }).click();
  const editor = page.getByRole("dialog");
  const sourceList = editor.getByRole("group", { name: "Källor" });
  await sourceList.waitFor();
  const checked = await sourceList.locator('label:has(input[type="checkbox"]:checked)').allTextContents();
  ok(checked.length === 1 && checked[0].includes(b.name) && checked[0].includes("I rapporten"), "Ny widget får rapportens källa automatiskt");
  await page.keyboard.press("Escape");

  // 3. Markera flera: källor
  await page.getByRole("checkbox", { name: "Markera Spend" }).check();
  await page.getByRole("region", { name: "Kampanjer" }).click({ modifiers: ["Shift"], position: { x: 200, y: 120 } });
  const bar = page.getByRole("toolbar", { name: "Åtgärder för markerade widgets" });
  ok(await bar.getByText("2 markerade").isVisible(), "Kryssruta och Shift-klick markerar widgets");
  await shot(page, "markerade");
  await bar.getByRole("button", { name: "Källor" }).click();
  const dlg = page.getByRole("dialog", { name: /Källor för 2 widgets/ });
  await dlg.getByRole("checkbox", { name: new RegExp(b.name) }).uncheck();
  await dlg.getByRole("checkbox", { name: new RegExp(a.name) }).check();
  await dlg.getByRole("button", { name: "Använd på 2 widgets" }).click();
  await dlg.waitFor({ state: "detached" });
  const bulk = await sourcesOf();
  ok(bulk.Spend[0] === a.id && bulk.Kampanjer[0] === a.id && bulk.Klick[0] === b.id, "Källorna ändrades bara på de markerade widgetarna");

  // 4. Markera flera: filter
  await page.getByRole("checkbox", { name: "Markera Spend" }).check();
  await page.getByRole("checkbox", { name: "Markera Kampanjer" }).check();
  await bar.getByRole("button", { name: "Filter" }).click();
  const fdlg = page.getByRole("dialog", { name: /Filter för 2 widgets/ });
  await fdlg.getByRole("button", { name: "Lägg till filter" }).click();
  await fdlg.getByRole("combobox", { name: "Villkor" }).click();
  await page.getByRole("option", { name: "innehåller", exact: true }).click();
  await fdlg.getByLabel("Filtertext").fill("BK");
  await fdlg.getByLabel("Filtertext").press("Enter");
  await fdlg.getByRole("button", { name: "Lägg till på 2 widgets" }).click();
  await fdlg.waitFor({ state: "detached" });
  const withFilter = await q(`SELECT title, jsonb_array_length(config->'filters') n FROM widgets WHERE "dashboardId" = $1 AND title IN ('Spend', 'Kampanjer', 'Klick') ORDER BY title`, [dashboardId]);
  ok(withFilter.find((r) => r.title === "Spend").n === 1 && withFilter.find((r) => r.title === "Kampanjer").n === 1 && withFilter.find((r) => r.title === "Klick").n === 0, "Filtret lades till på de markerade widgetarna");

  // 5. Duplicera och ta bort (markeringen ligger kvar efter en åtgärd – avmarkera först)
  await bar.getByRole("button", { name: "Avmarkera alla", exact: true }).click();
  await page.getByRole("checkbox", { name: "Markera Spend" }).check();
  await page.getByRole("checkbox", { name: "Markera Klick" }).check();
  await bar.getByRole("button", { name: "Duplicera" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".react-grid-item").length === 6, null, { timeout: 30_000 });
  ok((await q(`SELECT count(*)::int n FROM widgets WHERE "dashboardId" = $1`, [dashboardId]))[0].n === 6, "Två widgets duplicerades");
  await page.getByRole("checkbox", { name: "Markera Spend" }).first().check();
  await bar.getByRole("button", { name: "Markera alla", exact: true }).click();
  ok(await bar.getByText("6 markerade").isVisible(), "Markera alla");
  await bar.getByRole("button", { name: "Ta bort" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Ta bort" }).click();
  await page.getByText("Dashboarden är tom").waitFor({ timeout: 30_000 });
  ok((await q(`SELECT count(*)::int n FROM widgets WHERE "dashboardId" = $1`, [dashboardId]))[0].n === 0, "Alla markerade widgets togs bort");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await db.end();
}
