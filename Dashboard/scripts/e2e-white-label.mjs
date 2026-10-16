/**
 * Röktest för egen domän och avsändare (white label) mot ett produktionsbygge (port 3100).
 * DNS kan inte testas lokalt: domänen markeras som verifierad i databasen efter att
 * kontrollen visat att TXT-posten saknas. Byråns inställningar återställs efteråt.
 *   node scripts/e2e-white-label.mjs
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
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
const DOMAIN = "rapport.e2e-test.example";
/** GET med valfri Host-header (som när en kund öppnar länken på byråns domän). */
const getAs = (host, path) =>
  new Promise((resolve, reject) => {
    const r = httpRequest({ host: "127.0.0.1", port: 3100, path, method: "GET", headers: { host } }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    r.on("error", reject);
    r.end();
  });

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const [src] = await q(`SELECT id, "workspaceId", platform FROM connected_accounts WHERE "lastSyncedAt" IS NOT NULL AND platform = 'meta_ads' LIMIT 1`);
const [original] = await q(`SELECT "customDomain", "domainVerifiedAt", "emailFrom", "emailFromName", "emailVerifiedAt" FROM workspaces WHERE id = $1`, [src.workspaceId]);
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-wl-${Date.now()}`;
const dashboardId = `e2e-${randomUUID()}`;
const otherWs = `e2e-ws-${randomUUID()}`;
await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, 'E2E white label', $3, now())`, [clientId, src.workspaceId, slug]);
await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [src.workspaceId, clientId, src.id]);
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'WL-test', '{}', now())`, [dashboardId, src.workspaceId, clientId]);
// En annan byrå med egen verifierad domän: får inte visa vår byrås rapporter.
await q(`INSERT INTO workspaces (id, name, slug, "customDomain", "domainVerifiedAt", "updatedAt") VALUES ($1, 'E2E annan byrå', $1, 'annan.e2e-test.example', now(), now())`, [otherWs]);

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Domän och avsändare i inställningarna
  await page.goto(`${base}/settings/brand`);
  await page.getByLabel("Domän", { exact: true }).fill(`https://${DOMAIN.toUpperCase()}/`);
  await page.getByLabel("Namn", { exact: true }).fill("E2E Byrån");
  await page.getByLabel("E-postadress").fill("rapport@e2e-test.example");
  await page.getByRole("button", { name: "Spara domän och avsändare" }).click();
  await page.getByText(`_bk-rapport.${DOMAIN}`).waitFor({ timeout: 30_000 });
  ok(true, "Domänen normaliseras och DNS-posterna (CNAME + TXT) visas");
  ok(await page.getByText(/^bk-rapport-verify=/).isVisible(), "TXT-värdet med byråns verifieringskod visas");
  await page.getByRole("button", { name: "Kontrollera DNS" }).click();
  ok(await page.locator("[data-sonner-toast]").filter({ hasText: /TXT-posten hittades inte/ }).waitFor({ timeout: 30_000 }).then(() => true, () => false), "Utan DNS-post verifieras inte domänen");
  await page.getByRole("button", { name: "Kontrollera avsändare" }).click();
  ok(await page.locator("[data-sonner-toast]").filter({ hasText: /RESEND_API_KEY|Resend/ }).first().waitFor({ timeout: 30_000 }).then(() => true, () => false), "Avsändaren kräver verifiering hos e-posttjänsten");
  const saved = (await q(`SELECT "customDomain", "domainVerifiedAt", "emailVerifiedAt" FROM workspaces WHERE id = $1`, [src.workspaceId]))[0];
  ok(saved.customDomain === DOMAIN && !saved.domainVerifiedAt && !saved.emailVerifiedAt, "Inget aktiveras förrän det är verifierat");

  // 2. Verifierad domän → delningslänkar på domänen
  await q(`UPDATE workspaces SET "domainVerifiedAt" = now(), "emailVerifiedAt" = now() WHERE id = $1`, [src.workspaceId]);
  await page.goto(`${base}/clients/${slug}/dashboards/${dashboardId}`);
  await page.getByRole("button", { name: /Dela och exportera/ }).click();
  await page.getByRole("menuitem", { name: /Dela länk med kunden/ }).click();
  await page.getByLabel("Namn (för er)").fill("WL");
  await page.getByRole("button", { name: "Skapa länk" }).click();
  const linkInput = page.getByLabel(/Länk WL/);
  await linkInput.waitFor();
  const shareUrl = await linkInput.inputValue();
  ok(shareUrl.startsWith(`https://${DOMAIN}/s/`), `Nya delningslänkar använder byråns domän (${shareUrl.slice(0, 40)}…)`);
  const path = new URL(shareUrl).pathname;

  // 3. Värdnamnsskydd
  ok((await getAs(DOMAIN, path)) === 200, "Rapporten öppnas på byråns domän");
  ok((await getAs(DOMAIN, "/clients")) === 404, "Appen visas inte på byråns domän");
  ok((await getAs("annan.e2e-test.example", path)) === 404, "En annan byrås domän kan inte visa rapporten");
  ok((await getAs("okand.example", path)) === 404, "Okända domäner visar inga rapporter");
  ok((await getAs("localhost:3100", path)) === 200, "Länken fungerar fortfarande på appens adress");

  // 4. Avsändaren används i mejl (larm som slår till)
  await q(`INSERT INTO alert_rules (id, "workspaceId", "clientId", kind, metric, op, threshold, "window", "accountIds", "recipientIds", "updatedAt") VALUES ($1, $2, $3, 'metric', 'spend', 'above', 1, 'last_7', '{}', '{}', now())`, [randomUUID(), src.workspaceId, clientId]);
  const outbox = join(root, ".outbox");
  const before = new Set(await readdir(outbox).catch(() => []));
  await fetch(`${base}/api/cron/alerts`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET || process.env.BETTER_AUTH_SECRET}` } });
  const fresh = (await readdir(outbox)).filter((m) => !before.has(m)).sort();
  const mail = JSON.parse(await readFile(join(outbox, fresh.at(-1), "mail.json"), "utf8"));
  ok(mail.from === "E2E Byrån <rapport@e2e-test.example>", `Mejl skickas från byråns avsändare (${mail.from})`);

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`UPDATE workspaces SET "customDomain" = $2, "domainVerifiedAt" = $3, "emailFrom" = $4, "emailFromName" = $5, "emailVerifiedAt" = $6 WHERE id = $1`, [
    src.workspaceId, original.customDomain, original.domainVerifiedAt, original.emailFrom, original.emailFromName, original.emailVerifiedAt,
  ]);
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await q(`DELETE FROM workspaces WHERE id = $1`, [otherWs]);
  await db.end();
}
