/**
 * Röktest för fas 3: valutaomräkning, källfördelning, egen metric via
 * inställningarna och användning i en widget.
 *   node scripts/e2e-phase3.mjs [--shots <katalog>]
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

// 1. Mergad dashboard: omräkning och källfördelning
await page.goto(`${base}/clients/demo-finans`);
await page.getByRole("link", { name: /Alla kanaler/ }).click();
await page.waitForSelector(".react-grid-layout");
await page.waitForTimeout(800);
const spend = page.locator("section", { has: page.getByRole("heading", { name: "Spend", exact: true }) });
ok((await spend.textContent()).includes("omräknade till SEK med ECB:s dagskurs"), "USD-kontot räknas om till SEK med ECB-kurs");
ok(/Google\s*\d+ %/.test(await spend.textContent()) && /LinkedIn\s*\d+ %/.test(await spend.textContent()), "KPI visar källfördelning (Google x %, LinkedIn y %)");
const job = page.locator("section", { hasText: "Jobbtitel (bara LinkedIn" });
ok((await job.textContent()).includes("finns inte för Google Analytics 4"), "Dimension som saknas i en källa markeras");
await shot(page, "fas3-alla-kanaler");

// 2. Skapa en egen metric med formel
await page.goto(`${base}/settings/metrics`);
await page.getByRole("button", { name: "Ny metric" }).click();
await page.getByLabel("Namn").fill("Klick per besök");
await page.getByLabel("Formel").fill("clicks / sessiions[ga4]");
ok((await page.getByRole("status").textContent()).includes('Okänd metric "sessiions"'), "Felaktig formel ger tydligt fel");
await page.getByLabel("Formel").fill("clicks / sessions[ga4]");
ok((await page.getByRole("status").textContent()).includes("Klick / Besök (Google Analytics 4)"), "Giltig formel beskrivs i klartext");
await shot(page, "fas3-formel");
await page.getByRole("button", { name: "Spara" }).click();
await page.waitForTimeout(800);
ok(await page.getByText("clicks / sessions[ga4]").isVisible(), "Egen metric sparad");

// 3. Använd den i en KPI-widget på dashboarden
await page.goto(`${base}/clients/demo-finans`);
await page.getByRole("link", { name: /Alla kanaler/ }).click();
await page.waitForSelector(".react-grid-layout");
const before = await page.locator(".react-grid-item").count();
await page.getByRole("button", { name: "Redigera" }).click();
await page.getByRole("button", { name: "Lägg till widget" }).click();
const boxes = page.locator('fieldset:has(legend:text("Källor")) input[type=checkbox]');
for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
await page.getByRole("button", { name: "Lägg till metric" }).click();
await page.getByPlaceholder("Sök metric…").fill("Klick per besök");
await page.getByRole("option", { name: /Klick per besök/ }).click();
// Ta bort standardmetricen så att bara den egna visas
await page.getByRole("button", { name: /^Ta bort (Spend|Besök)$/ }).first().click();
await page.waitForTimeout(1500);
const preview = await page.locator('[role=dialog]').textContent();
ok(/\d+,\d+/.test(preview) && preview.includes("Klick per besök"), "Förhandsvisningen räknar ut den egna metricen");
await page.getByRole("button", { name: "Lägg till", exact: true }).click();
await page.waitForTimeout(1500);
ok((await page.locator(".react-grid-item").count()) === before + 1, "Widget med egen metric sparad");

ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
