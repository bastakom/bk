/**
 * Röktest för fas 4: PDF-export (A4 och lång sida), schemaläggning,
 * "Skicka nu" till utkorgen och workerns schemalagda körning.
 *   node scripts/e2e-phase4.mjs [--shots <katalog>]
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
config({ path: `${root}.env`, quiet: true });
const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const shot = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FEL: ${msg}`);
  console.log(`✓ ${msg}`);
};
const pdfjs = await import(`${root}packages/reports/node_modules/pdfjs-dist/legacy/build/pdf.mjs`);
async function pdfText(buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => it.str ?? "").join(" ").replace(/\s+/g, " "));
  }
  return out;
}

const browser = await chromium.launch();
const login = async (email) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  return ctx.newPage();
};
const page = await login(process.env.SEED_USER_EMAIL);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// 1. PDF-export från dashboarden
await page.goto(`${base}/clients/demo-finans`);
await page.getByRole("link", { name: /Årsrapport/ }).click();
await page.waitForSelector(".react-grid-layout");
await page.getByRole("button", { name: "PDF" }).click();
await shot(page, "fas4-export-dialog");
const [download] = await Promise.all([page.waitForEvent("download", { timeout: 90_000 }), page.getByRole("button", { name: "Ladda ner" }).click()]);
ok(/Demo-Finans-Arsrapport-2025-01-01_2025-12-31\.pdf/.test(download.suggestedFilename()), `Filnamn: ${download.suggestedFilename()}`);
const pdf = await readFile(await download.path());
ok(pdf.subarray(0, 5).toString() === "%PDF-", "Nedladdningen är en PDF");
{
  const pages = await pdfText(pdf);
  ok(pages.length >= 5, `A4-PDF har ${pages.length} sidor`);
  ok(pages[0].includes("Årsrapport") && pages[0].includes("1 jan. – 31 dec. 2025"), "Omslag med titel och period");
  ok(pages[1].includes("Innehåll") && pages[1].includes("LinkedIn Ads"), "Innehållsförteckning med sektioner");
  ok(pages.slice(2).every((t, i) => t.includes(`Sida ${i + 1} av ${pages.length - 2}`)), "Sidfot med sidnummer på varje innehållssida");
  const all = pages.join(" ");
  ok(!all.includes("@@S"), "Inga mätmarkörer kvar i PDF:en");
  ok(!/lorem|ipsum/i.test(all), "Ingen platshållartext");
  ok(!all.includes("…"), "Ingen avklippt text (…) i PDF:en");
}

// 2. Lång sida via API
const long = await page.request.get(`${page.url().split("?")[0].replace("/clients/demo-finans/dashboards/", "/api/dashboards/")}/pdf?layout=long`);
ok(long.ok() && long.headers()["x-page-count"] === "1", "Lång sida: en PDF-sida");

// 3. Schemalägg + Skicka nu
await page.getByRole("button", { name: "Fler val för dashboarden" }).click();
await page.getByRole("menuitem", { name: /Schemalagda utskick/ }).click();
await page.getByLabel("Mottagare").fill("anna@demofinans.se, Marknad@demofinans.se");
await page.getByLabel("Meddelande (valfritt)").fill("Hej! Här kommer veckans rapport.");
await page.getByRole("button", { name: "Schemalägg" }).click();
await page.waitForTimeout(1200);
ok(await page.getByText("Varje måndag kl. 07:00").first().isVisible(), "Schemat syns i dialogen (måndagar 07:00)");
await shot(page, "fas4-schema");
await page.getByRole("button", { name: "Skicka nu" }).click();
await page.getByText(/Lagt i utkorgen|Skickat till/).waitFor({ timeout: 90_000 });
ok(true, "Skicka nu: rapporten renderades och skickades");

// 4. Workern skickar förfallna scheman
const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
await db.query(`UPDATE report_schedules SET "nextRunAt" = now() - interval '1 minute' WHERE recipients @> ARRAY['anna@demofinans.se']`);
execFileSync("pnpm", ["--filter", "worker", "once"], { cwd: root, stdio: "pipe", env: process.env });
const { rows } = await db.query(`SELECT count(*)::int AS n FROM report_deliveries WHERE "scheduleId" IS NOT NULL AND status = 'SENT'`);
const { rows: next } = await db.query(`SELECT "nextRunAt" > now() AS future, "lockedAt" IS NULL AS unlocked FROM report_schedules WHERE recipients @> ARRAY['anna@demofinans.se']`);
ok(rows[0].n >= 1 && next[0].future && next[0].unlocked, "Workern skickade schemat och satte nästa körning");
await db.end();

// 5. Utskickssidan och utkorgen
await page.goto(`${base}/reports`);
ok((await page.getByText("I utkorgen").count()) >= 2, "Utskick listas med status");
await shot(page, "fas4-utskick");
const mail = await page.request.get(await page.getByRole("link", { name: "Mejl" }).first().getAttribute("href").then((h) => `${base}${h}`));
const html = await mail.text();
ok(html.includes("Här kommer veckans rapport") && html.includes("Öppna live-dashboarden"), "Mejlet innehåller meddelande och länk");

// 6. Läsare kan exportera men inte schemalägga
const viewer = await login("lasare@bastakompisar.se");
await viewer.goto(page.url().replace("/reports", "/clients/demo-finans"));
await viewer.getByRole("link", { name: /Årsrapport/ }).click();
await viewer.waitForSelector(".react-grid-layout");
ok(await viewer.getByRole("button", { name: "PDF" }).isVisible(), "Läsare ser PDF-exporten");
ok((await viewer.getByRole("button", { name: "Fler val för dashboarden" }).count()) === 0, "Läsare kan inte schemalägga");

ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
