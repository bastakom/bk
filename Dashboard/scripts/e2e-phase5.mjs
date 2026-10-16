/**
 * Röktest för fas 5: riktiga GA4-connectorn mot den simulerade Google-servern
 * (pnpm fake-google) via ett produktionsbygge på port 3100 (se lib/test-server.mjs).
 * Koppla via OAuth, synka, token-förnyelse i workern, återkallad behörighet → larm,
 * koppla om → larmet stängs.
 *   node scripts/e2e-phase5.mjs [--shots <katalog>]
 */
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { chromium } from "playwright";
import { pickSources, waitForSync } from "./lib/sources.mjs";
import { FAKE_ENV, startTestServer, TEST_BASE } from "./lib/test-server.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
config({ path: `${root}.env`, quiet: true });
const base = TEST_BASE;
const google = FAKE_ENV.GA4_DATA_BASE;
const { stop: stopServer } = await startTestServer(root);
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const shot = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FEL: ${msg}`);
  console.log(`✓ ${msg}`);
};
const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const worker = () => execFileSync("pnpm", ["--filter", "worker", "once"], { cwd: root, stdio: "pipe", env: { ...process.env, ...FAKE_ENV } }).toString();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// 1. Koppla GA4 via Google-inloggning (simulerad) i Databaser
const started = new Date();
await page.goto(`${base}/databases`);
await page.getByRole("button", { name: "Koppla ny inloggning" }).first().click();
const card = page.getByRole("dialog").locator("li", { hasText: "Riktig koppling via Google" }).filter({ hasText: "Google Analytics 4" });
ok((await card.count()) === 1, "Databaser erbjuder riktig GA4-koppling");
await card.getByRole("link", { name: "Koppla Google Analytics 4", exact: true }).click();
await page.waitForURL(/127\.0\.0\.1:4010\/o\/oauth2/);
ok((await page.content()).includes("Se din Google Analytics-data (endast läsning)"), "Google-samtycke begär bara läsrättighet");
await shot(page, "fas5-google-samtycke");
await page.getByRole("link", { name: "Tillåt" }).click();
await page.waitForURL(/\/databases/);
const gaCard = page.getByRole("article", { name: "Google Analytics 4 – marknad@bastakompisar.se" }).filter({ hasNotText: "Demodata" });
await gaCard.waitFor();
ok((await gaCard.locator("tbody tr").count()) === 6, "Alla properties från Admin API listas i Databaser");
ok((await gaCard.getByText("Ingen kund – synkas inte").count()) === 6, "Inga properties synkas innan en kund väljer dem");
await shot(page, "fas5-databaser");

// Kunden väljer två av properties
await pickSources(page, base, "helsingborgs-cykelverkstad", [
  { name: "Demo Cykelverkstad", login: "marknad@bastakompisar.se" },
  { name: "Gammal property (ingen åtkomst)", login: "marknad@bastakompisar.se" },
]);
const chosen = (await q(`SELECT id FROM connected_accounts WHERE "connectorId" = 'ga4' AND name IN ('Demo Cykelverkstad', 'Gammal property (ingen åtkomst)')`)).map((r) => r.id);
await waitForSync(q, chosen);
await page.reload();

// 2. Status efter första synken
const accounts = await q(`SELECT a.id, a.name, a.status, a."statusMessage", a."connectionId", a."lastSyncedAt" FROM connected_accounts a WHERE "connectorId" = 'ga4' ORDER BY name`);
ok((await q(`SELECT count(*)::int n FROM connected_accounts a WHERE "connectorId" = 'ga4' AND "lastSyncAttemptAt" IS NULL`))[0].n === 4, "Properties utan kund synkades inte");
const good = accounts.find((a) => a.name === "Demo Cykelverkstad");
const noAccess = accounts.find((a) => a.name.startsWith("Gammal property"));
ok(good?.status === "OK" && good.lastSyncedAt, "Property med åtkomst synkades");
ok(noAccess?.status === "AUTH_REQUIRED" && /saknar åtkomst/.test(noAccess.statusMessage), "Property utan åtkomst markeras – utan att påverka den andra");
const facts = await q(`SELECT count(*)::int AS n, min(date) AS first FROM metric_facts WHERE "accountId" = $1`, [good.id]);
ok(facts[0].n > 20_000, `Tre års GA4-data sparad (${facts[0].n} rader)`);
const alerts = await q(`SELECT kind, "notifiedAt" FROM sync_alerts WHERE "accountId" = $1 AND "resolvedAt" IS NULL`, [noAccess.id]);
ok(alerts.length === 1 && alerts[0].notifiedAt, "Larm skapat och mejlat till byråns admins");
const row = page.locator("li", { hasText: "Demo Cykelverkstad" }).filter({ hasText: "Google Analytics 4" }).first();
ok(/\d/.test(await row.locator("dd").first().textContent()), "Kundsidan visar besök från riktiga connectorn");
await shot(page, "fas5-kundsida");

// 3. Access token blir ogiltig hos Google före sitt utgångsdatum → workern förnyar och synkar
await fetch(`${google}/__admin/expire`, { method: "POST" });
const tokensBefore = (await q(`SELECT "encryptedTokens" FROM connections WHERE id = $1`, [good.connectionId]))[0].encryptedTokens;
await q(`UPDATE connected_accounts SET "lastSyncAttemptAt" = now() - interval '5 hours' WHERE id = $1`, [good.id]);
const out = worker();
const after = (await q(`SELECT status, "lastSyncedAt" FROM connected_accounts WHERE id = $1`, [good.id]))[0];
const tokensAfter = (await q(`SELECT "encryptedTokens" FROM connections WHERE id = $1`, [good.connectionId]))[0].encryptedTokens;
ok(/"event":"sync".*"ok":true/.test(out) && after.status === "OK", "Workern synkade kontot (strukturerad logg)");
ok(tokensAfter !== tokensBefore, "Utgången token förnyades och sparades krypterad");

// 4. Återkallad behörighet → hela inloggningen markeras + larm
await fetch(`${google}/__admin/revoke`, { method: "POST" });
await q(`UPDATE connected_accounts SET "lastSyncAttemptAt" = now() - interval '5 hours' WHERE id = $1`, [good.id]);
worker();
const revoked = (await q(`SELECT a.status, c.status AS conn FROM connected_accounts a JOIN connections c ON c.id = a."connectionId" WHERE a.id = $1`, [good.id]))[0];
ok(revoked.status === "AUTH_REQUIRED" && revoked.conn === "AUTH_REQUIRED", "Återkallad Google-behörighet markerar kopplingen");
ok((await q(`SELECT 1 FROM sync_alerts WHERE "accountId" = $1 AND "resolvedAt" IS NULL AND kind = 'AUTH_REQUIRED'`, [good.id])).length === 1, "Larm för tappad behörighet");
const again = worker();
ok(!again.includes(good.id), "Workern slutar försöka tills kontot kopplats om");
ok((await q(`SELECT count(*)::int AS n FROM sync_alerts WHERE "accountId" = $1`, [good.id]))[0].n === 1, "Inget dubbellarm vid upprepade körningar");

// 5. Koppla om i Databaser → OK och larmet stängs
await page.goto(`${base}/databases`);
const broken = page.getByRole("article", { name: "Google Analytics 4 – marknad@bastakompisar.se" }).filter({ hasText: "Behöver kopplas om" });
await broken.getByRole("link", { name: "Koppla om" }).click();
await page.getByRole("link", { name: "Tillåt" }).click();
await page.waitForURL(/\/databases/, { timeout: 120_000 });
const until = Date.now() + 120_000;
while ((await q(`SELECT status FROM connected_accounts WHERE id = $1`, [good.id]))[0].status !== "OK" && Date.now() < until) await new Promise((r) => setTimeout(r, 1000));
const fixed = (await q(`SELECT status, "connectionId" FROM connected_accounts WHERE id = $1`, [good.id]))[0];
ok(fixed.status === "OK" && fixed.connectionId !== good.connectionId, "Omkopplad källa flyttades till nya inloggningen och synkar igen");
ok((await q(`SELECT 1 FROM sync_alerts WHERE "accountId" = $1 AND "resolvedAt" IS NULL`, [good.id])).length === 0, "Larmet stängdes automatiskt");
ok((await q(`SELECT count(*)::int n FROM client_sources WHERE "accountId" = $1`, [good.id]))[0].n === 1, "Kundens val av källan behölls");

// 6. Synklogg
await page.goto(`${base}/settings/sync`);
ok(await page.getByText("Gammal property (ingen åtkomst)").first().isVisible(), "Synkloggen visar öppna larm");
await shot(page, "fas5-synklogg");

ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
// Städa: inloggningar som testet skapat (simulerad Google) och deras källor.
await q(`DELETE FROM connections WHERE "connectorId" = 'ga4' AND "createdAt" >= $1`, [started]);
await db.end();
await browser.close();
stopServer();
