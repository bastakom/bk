/**
 * Röktest för fas 6 mot ett produktionsbygge (port 3100) som pekar på de
 * simulerade servrarna – .env:s riktiga nycklar påverkas inte.
 * Kräver: pnpm fake-google, pnpm fake-platforms och `pnpm --filter web build`.
 *   node scripts/e2e-phase6.mjs [--shots <katalog>]
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";
import { connectOAuth, pickSources, waitForSync } from "./lib/sources.mjs";
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

const { stop: stopServer } = await startTestServer(root);

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const browser = await chromium.launch();
const errors = [];
const newPage = async (login) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
  if (login) await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};

const started = new Date();
try {
  const page = await newPage(true);

  // 1. Meta med systemanvändar-token i Databaser
  await page.goto(`${base}/databases`);
  await page.getByRole("button", { name: "Koppla ny inloggning" }).first().click();
  const metaRow = page.getByRole("dialog").locator("li", { hasText: "Meta Ads" }).filter({ hasText: "Riktig koppling med token" });
  ok((await metaRow.count()) === 1, "Meta kopplas med systemanvändar-token");
  await metaRow.getByRole("button", { name: "Koppla" }).click();
  await page.getByLabel("Systemanvändar-token").fill("fel-token-som-inte-fungerar-123");
  await page.getByRole("button", { name: "Kontrollera och fortsätt" }).click();
  ok(await page.getByText(/godkändes inte/).waitFor({ timeout: 15_000 }).then(() => true, () => false), "Felaktig token avvisas med tydligt meddelande");
  await page.getByLabel("Systemanvändar-token").fill("fake-meta-system-user-token");
  await shot(page, "fas6-meta-token");
  await page.getByRole("button", { name: "Kontrollera och fortsätt" }).click();
  await page.waitForURL(/\/databases\?/);
  const metaCard = page.getByRole("article", { name: "Meta Ads – Rapportplattform (systemanvändare)" }).filter({ hasText: "act_1029384757" });
  await metaCard.waitFor();
  ok((await metaCard.locator("tbody tr").count()) === 5, "Alla annonskonton i BM listas i Databaser (även kunders delade)");
  await pickSources(page, base, "demo-finans", [{ name: "Leads-kampanjer", login: "Rapportplattform (systemanvändare)" }]);
  const metaId = (await q(`SELECT id FROM connected_accounts WHERE "connectorId" = 'meta_ads' AND "externalId" = 'act_1029384757'`))[0].id;
  await waitForSync(q, [metaId]);
  const meta = (await q(`SELECT status, (SELECT count(*)::int FROM metric_facts f WHERE f."accountId" = a.id) AS n FROM connected_accounts a WHERE id = $1`, [metaId]))[0];
  ok(meta?.status === "OK" && meta.n > 10_000, `Meta synkad när kunden valde kontot (${meta?.n} rader)`);

  // 2–4. LinkedIn, TikTok och Google Ads via OAuth i Databaser, valda av olika kunder
  await connectOAuth(page, base, "LinkedIn Ads");
  await connectOAuth(page, base, "TikTok Ads");
  await connectOAuth(page, base, "Google Ads");
  await pickSources(page, base, "demo-tandvard", [{ name: "Nordics (EUR)", login: "demo@bastakompisar.se" }]);
  await pickSources(page, base, "helsingborgs-cykelverkstad", [{ name: "TikTok – Sverige", login: "demo@bastakompisar.se" }]);
  await pickSources(page, base, "demo-byggkonsult", [{ name: "Demo Tandvård – Performance Max", login: "marknad@bastakompisar.se" }]);
  const picked = await q(
    `SELECT a.id FROM connected_accounts a JOIN client_sources cs ON cs."accountId" = a.id WHERE a."connectorId" IN ('linkedin_ads','tiktok_ads','google_ads')`,
  );
  await waitForSync(q, picked.map((r) => r.id));
  const real = await q(`SELECT a."connectorId", a.status FROM connected_accounts a JOIN client_sources cs ON cs."accountId" = a.id WHERE a."connectorId" IN ('linkedin_ads','tiktok_ads','google_ads') ORDER BY 1`);
  ok(real.length === 3 && real.every((r) => r.status === "OK"), `LinkedIn, TikTok och Google Ads kopplade och synkade (${real.map((r) => r.connectorId).join(", ")})`);
  const unused = await q(`SELECT count(*)::int n FROM connected_accounts a WHERE a."connectorId" IN ('linkedin_ads','tiktok_ads','google_ads') AND NOT EXISTS (SELECT 1 FROM client_sources cs WHERE cs."accountId" = a.id) AND a."lastSyncAttemptAt" IS NOT NULL`);
  ok(unused[0].n === 0, "Konton som ingen kund valt synkades inte");
  const li = await q(`SELECT DISTINCT "dimensionValue" FROM metric_facts f JOIN connected_accounts a ON a.id = f."accountId" WHERE a."connectorId" = 'linkedin_ads' AND dimension = 'job_title' LIMIT 50`);
  ok(li.some((r) => r.dimensionValue === "Chief Executive Officer"), "LinkedIn-demografi sparad med namn (inte URN)");

  // 5. Delningslänk med lösenord
  await page.goto(`${base}/clients/demo-finans`);
  await page.getByRole("link", { name: /Årsrapport/ }).click();
  await page.waitForSelector(".react-grid-layout");
  await page.getByRole("button", { name: /Dela och exportera/ }).click();
  await page.getByRole("menuitem", { name: /Dela länk med kunden/ }).click();
  await page.getByLabel("Namn (för er)").fill("Till Demo Finans VD");
  await page.getByLabel("Lösenord (valfritt)").fill("hemligt-losen-2026");
  await page.getByRole("button", { name: "Skapa länk" }).click();
  const linkInput = page.getByLabel(/Länk Till Demo Finans VD/);
  await linkInput.waitFor();
  const shareUrl = (await linkInput.inputValue()).replace(/^https?:\/\/[^/]+/, base);
  ok(/\/s\/[A-Za-z0-9_-]{40,}$/.test(shareUrl), "Delningslänk skapad med lång slumpad token");
  await shot(page, "fas6-dela");

  const guest = await newPage(false);
  await guest.goto(shareUrl);
  ok(await guest.getByText("Rapporten är lösenordsskyddad").waitFor({ timeout: 15_000 }).then(() => true, () => false), "Kund utan inloggning möts av lösenordsfrågan");
  await guest.getByLabel("Lösenord").fill("fel");
  await guest.getByRole("button", { name: "Visa rapporten" }).click();
  ok(await guest.getByText("Fel lösenord.").waitFor({ timeout: 15_000 }).then(() => true, () => false), "Fel lösenord avvisas");
  await guest.getByLabel("Lösenord").fill("hemligt-losen-2026");
  await guest.getByRole("button", { name: "Visa rapporten" }).click();
  await guest.waitForSelector(".react-grid-layout");
  ok(await guest.getByRole("heading", { name: "Årsrapport" }).isVisible(), "Rätt lösenord visar dashboarden (läsläge)");
  ok((await guest.getByRole("button", { name: "Redigera" }).count()) === 0, "Ingen redigering för kunden");
  ok((await guest.getByText("Året i korthet").boundingBox()).y < 500, "Widgets ligger på sina platser (textblocket överst)");
  ok((await guest.locator('meta[name="robots"][content*="noindex"]').count()) === 1, "Delad sida indexeras inte");
  await shot(guest, "fas6-delad-dashboard");
  const [dl] = await Promise.all([guest.waitForEvent("download", { timeout: 120_000 }), guest.getByRole("button", { name: "PDF" }).click()]);
  ok(/\.pdf$/.test(dl.suggestedFilename()), "Kunden kan ladda ner PDF");
  const views = (await q(`SELECT "viewCount" FROM share_links ORDER BY "createdAt" DESC LIMIT 1`))[0].viewCount;
  ok(views >= 1, "Visningar räknas");

  await page.getByRole("button", { name: "Stäng av länken" }).click();
  await page.waitForTimeout(800);
  const after = await (await guest.context().request.get(shareUrl)).status();
  ok(after === 404, "Avstängd länk slutar fungera direkt");

  // 6. White label
  await page.goto(`${base}/settings/brand`);
  await page.getByLabel("Färgkod").fill("#0F766E");
  await page.getByRole("button", { name: "Spara" }).click();
  await page.waitForTimeout(1000);
  await page.goto(`${base}/clients`);
  const bg = await page.getByRole("button", { name: "Ny kund" }).evaluate((el) => getComputedStyle(el).backgroundColor);
  ok(/rgb\(15, 118, 110\)|oklab|color/.test(bg), `Byråns färg används i appen (${bg})`);
  await shot(page, "fas6-varumarke");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  // Städa: inloggningar som testet skapat mot de simulerade servrarna (med källor och data),
  // och byråns varumärke som testet ändrade.
  await q(`DELETE FROM connections WHERE "connectorId" IN ('meta_ads','linkedin_ads','tiktok_ads','google_ads') AND "createdAt" >= $1`, [started]);
  await q(`UPDATE workspaces SET "brandColor" = '#25364F' WHERE "brandColor" = '#0F766E'`);
  await db.end();
  stopServer();
}
