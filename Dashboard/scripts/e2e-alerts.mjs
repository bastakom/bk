/**
 * Röktest för larmregler mot ett produktionsbygge (port 3100): skapa larm i UI:t, "Testa nu",
 * körning via /api/cron/alerts (som workern), mejl till utkorgen och inga dubbelmejl.
 * Tillfällig kund som tas bort efteråt.  node scripts/e2e-alerts.mjs
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
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
const outbox = join(root, ".outbox");
const mails = async () => ((await readdir(outbox).catch(() => [])).sort());

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const [src] = await q(`SELECT id, "workspaceId", platform FROM connected_accounts WHERE "lastSyncedAt" IS NOT NULL AND platform = 'meta_ads' LIMIT 1`);
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-larm-${Date.now()}`;
await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, 'E2E larm', $3, now())`, [clientId, src.workspaceId, slug]);
await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [src.workspaceId, clientId, src.id]);
await q(`INSERT INTO client_goals (id, "workspaceId", "clientId", metric, target, period, "accountIds", "updatedAt") VALUES ($1, $2, $3, 'spend', 20000, 'month', '{}', now())`, [randomUUID(), src.workspaceId, clientId]);
// Andra byråers/kunders aktiva regler pausas inte – testet räknar bara sina egna.
const otherActive = (await q(`SELECT count(*)::int n FROM alert_rules WHERE active AND "clientId" <> $1`, [clientId]))[0].n;

const { stop } = await startTestServer(root);
const browser = await chromium.launch();
const errors = [];
const cron = (secret = process.env.CRON_SECRET || process.env.BETTER_AUTH_SECRET) => fetch(`${base}/api/cron/alerts`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/clients/${slug}?tab=mal`);

  // 1. Skapa larm
  const card = page.getByRole("region", { name: "Larm" });
  const create = async (fill) => {
    await card.getByRole("button", { name: "Nytt larm" }).click();
    const dlg = page.getByRole("dialog", { name: "Nytt larm" });
    await fill(dlg);
    await dlg.getByRole("button", { name: "Spara larm" }).click();
    await dlg.waitFor({ state: "detached" });
  };
  const pick = async (dlg, name, option) => {
    await dlg.getByRole("combobox", { name }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await create(async (dlg) => {
    await pick(dlg, "Nyckeltal", "Spend");
    await pick(dlg, "Villkor", "över");
    await dlg.getByLabel("Gräns").fill("1");
  });
  await create(async (dlg) => {
    await pick(dlg, "Nyckeltal", "Kostnad per klick");
    await pick(dlg, "Villkor", "under");
    await dlg.getByLabel("Gräns").fill("0,01");
    await pick(dlg, "Period", "i går");
  });
  await create(async (dlg) => {
    await dlg.getByRole("button", { name: "Mål" }).click();
  });
  await card.getByText("Spend senaste 7 dagarna över 1,00 kr").waitFor();
  ok((await card.getByRole("listitem").count()) === 3, "Tre larm skapade (nyckeltal över, nyckeltal under, mål)");
  ok(await card.getByText("Spend ligger efter eller överförbrukar").isVisible(), "Mållarmet beskrivs i klartext");

  // 2. Testa nu
  await card.getByRole("listitem").filter({ hasText: "Spend senaste 7 dagarna över 1,00 kr" }).getByRole("button", { name: "Testa nu" }).click();
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: /Larmar|OK/ }).last();
  await toast.waitFor({ timeout: 30_000 });
  const toastText = await toast.innerText();
  ok(toastText.includes("Larmar: Spend senaste 7 dagarna:") && toastText.includes("över 1,00"), `Testa nu visar aktuellt värde utan att mejla (${toastText.trim()})`);

  // 3. Körning som workern gör
  ok((await cron("fel-hemlighet")).status === 401, "Den interna adressen kräver hemligheten");
  const before = await mails();
  const r1 = await (await cron()).json();
  ok(r1.checked === 3 + otherActive && r1.errors === 0, `Alla förfallna regler kontrolleras (${r1.checked})`);
  const rules = await q(`SELECT metric, kind, firing, "lastNotifiedAt" FROM alert_rules WHERE "clientId" = $1 ORDER BY "createdAt"`, [clientId]);
  ok(rules[0].firing && rules[0].lastNotifiedAt, "Spend-larmet slår till och mejlas");
  ok(!rules[1].firing && !rules[1].lastNotifiedAt, "CPC-larmet slår inte till");
  ok(!rules[2].lastNotifiedAt, "Mållarmet mejlas inte när budgeten inte överförbrukas");
  const newMails = (await mails()).filter((m) => !before.includes(m));
  const html = await readFile(join(outbox, newMails.at(-1), "mail.html"), "utf8");
  const meta = await readFile(join(outbox, newMails.at(-1), "mail.json"), "utf8").catch(() => "");
  ok(newMails.length === 1 && html.includes("E2E larm") && html.includes("Spend senaste 7 dagarna"), "Larmmejlet ligger i utkorgen med kund och värde");
  ok(meta === "" || meta.includes("@"), "Mejlet har mottagare (byråns administratörer)");

  // 4. Inga dubbelmejl
  const r2 = await (await cron()).json();
  ok(r2.checked === 0, "Regler kontrolleras högst en gång per timme");
  await q(`UPDATE alert_rules SET "lastCheckedAt" = now() - interval '2 hours' WHERE "clientId" = $1`, [clientId]);
  const r3 = await (await cron()).json();
  ok(r3.triggered >= 1 && r3.notified === 0, "Larmet mejlas inte igen samma dygn");

  await page.reload();
  ok(await card.getByRole("listitem").filter({ hasText: "Spend senaste 7" }).getByText("Larmar").isVisible(), "Status visas på kundsidan");
  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await db.end();
}
