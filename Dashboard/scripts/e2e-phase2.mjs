/**
 * Röktest för fas 2 mot lokal server: lägg till widget via editorn,
 * applicera mallen på en annan kund och kontrollera att data visas.
 *   node scripts/e2e-phase2.mjs [--shots <katalog>]
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const shot = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FEL: ${msg}`);
  console.log(`✓ ${msg}`);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.request.post(`${base}/api/auth/sign-in/email`, {
  data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD },
  headers: { origin: base },
});

// 1. Öppna Årsrapporten
await page.goto(`${base}/clients/demo-finans`);
await page.getByRole("link", { name: /Årsrapport/ }).click();
await page.waitForSelector(".react-grid-layout");
const before = await page.locator(".react-grid-item").count();
ok(before > 30, `Årsrapporten har ${before} widgets`);

// 2. Redigera → Lägg till widget → Tabell per kampanj (Google Ads)
await page.getByRole("button", { name: "Redigera" }).click();
await page.getByRole("button", { name: "Lägg till widget" }).click();
await page.getByRole("button", { name: "Tabell", exact: true }).click();
const sources = page.locator('fieldset:has(legend:text("Källor")) input[type=checkbox]');
for (let i = 0; i < (await sources.count()); i++) if (await sources.nth(i).isChecked()) await sources.nth(i).uncheck();
await page.locator("label", { hasText: "Sök – Sverige" }).locator("input").check();
await page.getByRole("button", { name: "Lägg till metric" }).click();
await page.getByRole("option", { name: /^CTR/ }).click();
await page.waitForTimeout(1200);
await shot(page, "editor");
ok((await page.locator('[role=dialog] table tbody tr').count()) > 0, "Förhandsvisningen visar tabellrader");
await page.getByRole("button", { name: "Lägg till", exact: true }).click();
await page.waitForTimeout(1500);
ok((await page.locator(".react-grid-item").count()) === before + 1, "Widgeten sparades och visas i griden");
await page.getByRole("button", { name: "Klar" }).click();

// 3. Byt period
await page.getByRole("combobox", { name: "Period" }).click();
await page.getByRole("option", { name: "Senaste 90 dagarna" }).click();
await page.waitForURL(/range=last_90/);
await page.waitForTimeout(1200);
ok(page.url().includes("range=last_90"), "Perioden ändras via URL:en");

// 4. Applicera mallen på Demo Tandvård
await page.goto(`${base}/templates`);
await page.getByRole("link", { name: "Använd på kund" }).first().click();
await page.getByRole("combobox").first().click();
await page.getByRole("option", { name: "Demo Tandvård" }).click();
await page.waitForTimeout(300);
const mapped = await page.locator("text=/\\d+ av \\d+ mappade/").textContent();
ok(/3 av 3/.test(mapped ?? ""), `Källor auto-mappade: ${mapped}`);
await shot(page, "mapping");
await page.getByLabel("Dashboardens namn").fill("Årsrapport (från mall)");
await page.getByRole("button", { name: "Skapa dashboard" }).click();
await page.waitForURL(/\/clients\/demo-tandvard\/dashboards\//);
await page.waitForSelector(".react-grid-layout");
await page.waitForTimeout(1000);
const empty = await page.locator("text=Välj minst en källa.").count();
ok(empty === 0, "Alla widgets i den nya dashboarden har källor");
ok((await page.locator(".react-grid-item").count()) > 30, "Mallens widgets skapades hos den nya kunden");
await shot(page, "from-template");

ok(errors.length === 0, `Inga JavaScript-fel i sidan${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
