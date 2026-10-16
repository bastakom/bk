/**
 * Röktest för Databaser och kundernas val av källor mot ett produktionsbygge (port 3100).
 * Använder demodata: Demo Tandvårds Google Ads-konto "Performance Max" väljs även av
 * Demo Byggkonsult med ett kampanjfilter, och tas sedan bort igen.
 * Kräver `pnpm --filter web build`.  node scripts/e2e-databases.mjs [--shots <katalog>]
 */
import { config } from "dotenv";
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
const [byggkonsult] = await q(`SELECT id FROM clients WHERE slug = 'demo-byggkonsult'`);
const [pmax] = await q(`SELECT id FROM connected_accounts WHERE "connectorId" = 'mock_google_ads' AND "externalId" = '123-456-7891'`);
if (!byggkonsult || !pmax) throw new Error("Demodata saknas (kör seed).");
const cleanup = () => q(`DELETE FROM client_sources WHERE "clientId" = $1 AND "accountId" = $2`, [byggkonsult.id, pmax.id]);
await cleanup();

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
const login = async (email) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
};

try {
  const page = await login(process.env.SEED_USER_EMAIL);

  // 1. Databaser
  await page.goto(`${base}/databases`);
  ok(await page.getByRole("link", { name: "Databaser" }).isVisible(), "Databaser finns i menyn");
  ok(await page.getByRole("button", { name: "Koppla ny inloggning" }).first().isVisible(), "Admin kan koppla ny inloggning");
  const adsCard = page.getByRole("article", { name: /Google Ads – marknad@/ });
  const pmaxRow = adsCard.locator("tr", { hasText: "Performance Max" });
  ok((await pmaxRow.getByRole("link", { name: "Demo Tandvård" }).count()) === 1, "Kontot visar vilka kunder som använder det");
  ok((await adsCard.locator("tr", { hasText: "Sök – Sverige" }).getByText("Ingen kund – synkas inte").count()) === 1, "Konton utan kund markeras som osynkade");
  await shot(page, "databaser");

  // 2. Välj samma konto för en annan kund
  await page.goto(`${base}/clients/demo-byggkonsult`);
  await page.getByRole("button", { name: "Välj källor" }).first().click();
  await page.getByLabel("Sök källor").fill("Performance");
  const option = page.getByRole("checkbox", { name: /Performance Max \(Google Ads\)/ });
  ok((await page.getByRole("dialog").getByText("Används av Demo Tandvård").count()) === 1, "Väljaren visar att kontot redan används av en annan kund");
  await option.check();
  await shot(page, "valj-kallor");
  await page.getByRole("button", { name: "Lägg till 1" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Performance Max" }).filter({ hasText: "Används även av" });
  await row.waitFor({ timeout: 30_000 });
  ok(await row.getByText("Används även av Demo Tandvård").isVisible(), "Källan är vald och delas med Demo Tandvård");
  const spendBefore = (await row.locator("dd").first().textContent()).trim();

  // 3. Kundens filter på källan
  await row.getByRole("button", { name: /Fler val för Performance Max/ }).click();
  await page.getByRole("menuitem", { name: /Filter för kunden/ }).click();
  await page.getByRole("button", { name: "Lägg till filter" }).click();
  await page.getByRole("button", { name: /Välj kampanj/ }).click();
  const campaign = page.getByRole("option").filter({ hasNotText: "Lägg till" }).first();
  await campaign.waitFor();
  const campaignName = (await campaign.textContent()).trim();
  await campaign.click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Spara filter" }).click();
  await row.getByRole("list", { name: "Kundens filter för källan" }).waitFor({ timeout: 30_000 });
  ok((await row.getByText(campaignName).count()) >= 1, `Kundens filter visas på källan (Kampanj är ${campaignName})`);
  await page.waitForFunction((b) => [...document.querySelectorAll("li")].some((li) => li.textContent.includes("Används även av") && !li.textContent.includes(b)), spendBefore, { timeout: 30_000 });
  const spendAfter = (await row.locator("dd").first().textContent()).trim();
  const num = (s) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));
  ok(num(spendAfter) < num(spendBefore), `Nyckeltalen räknas med kundens filter (${spendBefore} → ${spendAfter})`);
  await shot(page, "kundfilter");

  // 4. Den andra kunden påverkas inte
  await page.goto(`${base}/clients/demo-tandvard`);
  const other = page.getByRole("listitem").filter({ hasText: "Performance Max" }).filter({ hasText: "Används även av" });
  ok((await other.getByText("Används även av Demo Byggkonsult").count()) === 1, "Demo Tandvård ser att källan delas");
  ok((await other.getByRole("list", { name: "Kundens filter för källan" }).count()) === 0, "Demo Byggkonsults filter gäller inte Demo Tandvård");

  // 5. Ta bort från kunden: källan och datan finns kvar
  await page.goto(`${base}/clients/demo-byggkonsult`);
  await row.getByRole("button", { name: /Fler val för Performance Max/ }).click();
  await page.getByRole("menuitem", { name: /Ta bort från kunden/ }).click();
  await page.getByRole("button", { name: "Ta bort från kunden" }).click();
  await row.waitFor({ state: "detached", timeout: 30_000 });
  const facts = (await q(`SELECT count(*)::int n FROM metric_facts WHERE "accountId" = $1`, [pmax.id]))[0].n;
  ok(facts > 0, `Källan är borttagen från kunden men datan finns kvar (${facts} rader)`);

  // 6. Redaktör: kan välja källor men inte koppla inloggningar
  const editor = await login("redaktor@bastakompisar.se");
  await editor.goto(`${base}/databases`);
  ok((await editor.getByRole("button", { name: "Koppla ny inloggning" }).count()) === 0, "Redaktör kan inte koppla eller ta bort inloggningar");
  await editor.goto(`${base}/clients/demo-byggkonsult`);
  ok(await editor.getByRole("button", { name: "Välj källor" }).first().isVisible(), "Redaktör kan välja källor för kunden");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await cleanup();
  await db.end();
}
