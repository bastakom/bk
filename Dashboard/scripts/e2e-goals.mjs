/**
 * Röktest för kundmål, målwidgeten och budgettakt mot ett produktionsbygge (port 3100).
 * Skapar en tillfällig kund som väljer en av byråns synkade källor och tar bort den efteråt.
 *   node scripts/e2e-goals.mjs [--shots <katalog>]
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
const [src] = await q(`SELECT id, "workspaceId", platform, name FROM connected_accounts WHERE "lastSyncedAt" IS NOT NULL AND platform = 'meta_ads' LIMIT 1`);
if (!src) throw new Error("Behöver en synkad Meta-källa.");
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-mal-${Date.now()}`;
const dashboardId = `e2e-${randomUUID()}`;
await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, 'E2E mål', $3, now())`, [clientId, src.workspaceId, slug]);
await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [src.workspaceId, clientId, src.id]);
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'Måltest', '{}', now())`, [dashboardId, src.workspaceId, clientId]);

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Mål på kundsidan
  await page.goto(`${base}/clients/${slug}?tab=mal`);
  const addGoal = async (metric, target, period) => {
    await page.getByRole("button", { name: "Lägg till mål" }).click();
    const dlg = page.getByRole("dialog", { name: "Nytt mål" });
    await dlg.getByRole("combobox", { name: "Metric" }).click();
    await page.getByRole("option", { name: metric, exact: true }).click();
    await dlg.getByLabel(/Målvärde/).fill(String(target));
    if (period) {
      await dlg.getByRole("combobox", { name: "Period" }).click();
      await page.getByRole("option", { name: period }).click();
    }
    await dlg.getByRole("button", { name: "Spara mål" }).click();
    await dlg.waitFor({ state: "detached" });
  };
  await addGoal("Spend (budget)", 20000);
  await addGoal("Klick", 5000, "per kvartal");
  await addGoal("Kostnad per klick", 2);
  const card = page.getByRole("region", { name: "Mål och budget" });
  await card.getByText("av 20 000 kr").waitFor();
  ok(await card.getByText("av 20 000 kr").isVisible(), "Budgetmålet visas med utfall (spend av 20 000 kr)");
  ok(await card.getByText(/budget per månad/).isVisible() && await card.getByText(/mål per kvartal/).isVisible(), "Perioder visas (månad och kvartal)");
  const statuses = await card.locator("li span.rounded-full").allTextContents();
  ok(statuses.length === 3 && statuses.every((s) => ["I fas", "Nära", "Efter", "Överförbrukning", "Underförbrukning", "Ingen data"].includes(s)), `Status per mål (${statuses.join(", ")})`);
  ok(await card.getByText(/Prognos .* borde ligga på/).first().isVisible(), "Prognos och var utfallet borde ligga i dag");
  const saved = await q(`SELECT metric, target, period FROM client_goals WHERE "clientId" = $1 ORDER BY "sortOrder"`, [clientId]);
  ok(saved.length === 3 && saved[0].metric === "spend" && saved[1].period === "quarter", "Målen sparas");
  await shot(page, "mal-kundsida");

  // 2. Målwidgeten i en rapport
  await page.goto(`${base}/clients/${slug}/dashboards/${dashboardId}`);
  await page.getByRole("button", { name: "Lägg till första widgeten" }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("button", { name: "Mål och budget" }).click();
  const goalsList = editor.getByRole("group", { name: "Mål att visa" });
  await goalsList.getByRole("checkbox").nth(0).check();
  await goalsList.getByRole("checkbox").nth(2).check();
  await editor.getByText("av 20 000 kr").waitFor({ timeout: 30_000 });
  ok(true, "Förhandsvisningen visar valda mål");
  await editor.getByRole("button", { name: /Lägg till|Spara/ }).last().click();
  await editor.waitFor({ state: "detached" });
  const widget = page.getByRole("region", { name: "Mål och budget" });
  await widget.getByText("av 20 000 kr").waitFor();
  ok((await widget.locator("li").count()) === 2, "Widgeten visar de två valda målen");
  ok((await widget.getByRole("img", { name: /% av målet/ }).count()) === 1, "Budgeten har stapel med markering för var den borde ligga");
  await shot(page, "mal-widget");

  // 3. Ta bort ett mål
  await page.goto(`${base}/clients/${slug}?tab=mal`);
  await page.getByRole("button", { name: "Ta bort Kostnad per klick" }).click();
  await page.getByRole("button", { name: "Ta bort Kostnad per klick" }).waitFor({ state: "detached" });
  ok((await q(`SELECT count(*)::int n FROM client_goals WHERE "clientId" = $1`, [clientId]))[0].n === 2, "Mål kan tas bort");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await db.end();
}
