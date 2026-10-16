/**
 * Röktest för behörighet per kund och kundportalen mot ett produktionsbygge (port 3100).
 *  - Admin bjuder in en kundinloggning (rollen Kund) och en läsare som bara ser en kund.
 *  - Inbjudan via mejl (utkorgen), lösenord väljs på inbjudningssidan.
 *  - Kunden ser bara portalens rapporter för sin kund; allt annat stoppas.
 * Tillfälliga kunder och användare tas bort efteråt.
 *   node scripts/e2e-portal.mjs [--shots <katalog>]
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
const shots = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const shot = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const ok = (cond, msg) => {
  if (!cond) throw new Error(`FEL: ${msg}`);
  console.log(`✓ ${msg}`);
};
const outbox = join(root, ".outbox");
const mails = async () => (await readdir(outbox).catch(() => [])).sort();

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const [src] = await q(`SELECT a.id, a."workspaceId" FROM connected_accounts a WHERE a.platform = 'ga4' AND a."lastSyncedAt" IS NOT NULL LIMIT 1`);
if (!src) throw new Error("Behöver en synkad GA4-källa.");
const ws = src.workspaceId;
const stamp = Date.now();
const clientEmail = `e2e-kund-${stamp}@example.test`;
const viewerEmail = `e2e-lasare-${stamp}@example.test`;
const password = `Portal-${randomUUID()}`;

const clients = {};
const dashboards = {};
for (const key of ["A", "B"]) {
  const id = `e2e-${randomUUID()}`;
  clients[key] = { id, name: `E2E Portal ${key} ${stamp}`, slug: `e2e-portal-${key.toLowerCase()}-${stamp}` };
  await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, $3, $4, now())`, [id, ws, clients[key].name, clients[key].slug]);
  await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [ws, id, src.id]);
}
const mkDashboard = async (key, client, name, inPortal) => {
  const id = `e2e-${randomUUID()}`;
  dashboards[key] = id;
  await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "inPortal", "updatedAt") VALUES ($1, $2, $3, $4, '{"range":{"preset":"last_30"}}', $5, now())`, [id, ws, client.id, name, inPortal]);
  const wid = randomUUID();
  await q(`INSERT INTO widgets (id, "workspaceId", "clientId", "dashboardId", type, title, config, layout, "updatedAt") VALUES ($1, $2, $3, $4, 'kpi', 'Nyckeltal', $5, '{"x":0,"y":0,"w":12,"h":4}', now())`, [
    wid, ws, client.id, id, JSON.stringify({ metrics: ["sessions"], sourcePlatforms: ["ga4"] }),
  ]);
  await q(`INSERT INTO widget_sources ("workspaceId", "clientId", "widgetId", "accountId") VALUES ($1, $2, $3, $4)`, [ws, client.id, wid, src.id]);
};
await mkDashboard("A1", clients.A, "Månadsrapport", true);
await mkDashboard("A2", clients.A, "Internt utkast", false);
await mkDashboard("B1", clients.B, "Annan kunds rapport", true);

const { stop } = await startTestServer(root, { RESEND_API_KEY: "" });
const browser = await chromium.launch();
const errors = [];
const watch = (page) => page.on("pageerror", (e) => errors.push(e.message));

/** Bjuder in via Inställningar → Team och returnerar länken ur mejlet. */
async function invite(admin, { email, role, client }) {
  const before = await mails();
  await admin.goto(`${base}/settings`);
  await admin.getByRole("button", { name: "Bjud in" }).click();
  const dlg = admin.getByRole("dialog");
  await dlg.getByLabel("E-post").fill(email);
  await dlg.getByLabel("Roll").click();
  await admin.getByRole("option", { name: role, exact: true }).click();
  await dlg.getByRole("button", { name: "Kunder" }).click();
  await admin.getByRole("option", { name: client.name }).click();
  await admin.keyboard.press("Escape");
  await dlg.getByRole("button", { name: "Skicka inbjudan" }).click();
  await admin.getByText(`Inbjudan skickad till ${email}.`).waitFor();
  const fresh = (await mails()).filter((m) => !before.includes(m));
  const meta = JSON.parse(await readFile(join(outbox, fresh.at(-1), "mail.json"), "utf8"));
  ok(meta.to.includes(email), `Inbjudan mejlas till ${email}`);
  const html = await readFile(join(outbox, fresh.at(-1), "mail.html"), "utf8");
  return /href="([^"]+\/invite\/[^"]+)"/.exec(html)[1].replace(/^https?:\/\/[^/]+/, base);
}

/** Tar emot inbjudan i en ny webbläsare: namn + lösenord. */
async function accept(link, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(link);
  await page.getByLabel("Namn").fill(name);
  await page.getByLabel("Välj lösenord").fill(password);
  await page.getByRole("button", { name: "Kom igång" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/invite"), { timeout: 30_000 });
  return page;
}

try {
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await adminCtx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const admin = await adminCtx.newPage();
  watch(admin);

  // 1. Kundinloggning
  const link = await invite(admin, { email: clientEmail, role: "Kund", client: clients.A });
  ok(await admin.getByRole("list", { name: "Medlemmar" }).getByText(clientEmail, { exact: true }).waitFor().then(() => true), "Inbjudan syns som väntande i teamlistan");
  await shot(admin, "team");
  const kund = await accept(link, "Kim Kund");
  await kund.waitForURL(`${base}/portal/${dashboards.A1}`);
  ok(true, "Kunden landar direkt i sin enda rapport");
  await kund.getByRole("region", { name: "Nyckeltal" }).getByText(/^fg\./).waitFor({ timeout: 30_000 });
  ok(true, "Rapporten visar data");
  ok(!(await kund.getByRole("button", { name: /AI-analys|Redigera|Dela/ }).count()), "Inga interna funktioner (AI-analys, redigering, delning)");
  await shot(kund, "portal-rapport");
  const pdf = await kund.request.get(`${base}/portal/${dashboards.A1}/pdf`);
  ok(pdf.ok() && pdf.headers()["content-type"].includes("pdf"), "Kunden kan ladda ner PDF");

  for (const [what, path] of [
    ["annan kunds rapport", `/portal/${dashboards.B1}`],
    ["rapport som inte visas i portalen", `/portal/${dashboards.A2}`],
  ]) {
    const res = await kund.goto(`${base}${path}`);
    ok(res.status() === 404, `Stoppas: ${what}`);
  }
  ok((await kund.request.get(`${base}/portal/${dashboards.B1}/pdf`)).status() === 404, "Stoppas: PDF för annan kunds rapport");
  for (const path of ["/clients", "/settings", `/clients/${clients.A.slug}`]) {
    await kund.goto(`${base}${path}`);
    ok(new URL(kund.url()).pathname.startsWith("/portal"), `Byråns app (${path}) skickar kunden till portalen`);
  }

  // 2. Byrån visar ytterligare en rapport i portalen via Dela
  await admin.goto(`${base}/clients/${clients.A.slug}/dashboards/${dashboards.A2}`);
  await admin.getByRole("button", { name: /Dela och exportera/ }).click();
  await admin.getByRole("menuitem", { name: /Dela länk med kunden/ }).click();
  await admin.getByLabel("Visa i kundportalen").check();
  await admin.getByText("Rapporten visas i kundportalen.").waitFor();
  ok(await admin.getByText(/1 person hos kunden/).isVisible(), "Dela-dialogen visar att kunden har en inloggning");
  await kund.goto(`${base}/portal`);
  const list = kund.getByRole("link", { name: /Månadsrapport|Internt utkast|Annan kunds/ });
  await list.first().waitFor();
  const names = await list.allInnerTexts();
  ok(names.length === 2 && names.some((n) => n.includes("Internt utkast")) && !names.some((n) => n.includes("Annan kunds")), "Portalen listar kundens två rapporter, inga andras");
  await shot(kund, "portal-lista");

  // 3. Läsare begränsad till kund B
  const vlink = await invite(admin, { email: viewerEmail, role: "Läsare", client: clients.B });
  const viewer = await accept(vlink, "Vera Läsare");
  await viewer.goto(`${base}/clients`);
  ok(await viewer.getByText(clients.B.name).first().isVisible(), "Läsaren ser sin kund");
  ok(!(await viewer.getByText(clients.A.name).count()), "Läsaren ser inte andra kunder");
  const res = await viewer.goto(`${base}/clients/${clients.A.slug}`);
  ok(res.status() === 404, "Läsaren stoppas från annan kunds sida");
  const rows = await q(`SELECT role, "clientIds" FROM memberships m JOIN users u ON u.id = m."userId" WHERE u.email = $1`, [viewerEmail]);
  ok(rows[0]?.role === "VIEWER" && rows[0].clientIds.length === 1 && rows[0].clientIds[0] === clients.B.id, "Medlemskapet sparas med roll och kund");

  // 4. Inbjudan går inte att använda igen
  const again = await (await browser.newContext()).newPage();
  await again.goto(link);
  ok(await again.getByText("Inbjudan gäller inte längre").isVisible(), "Använd inbjudningslänk fungerar inte igen");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  await q(`DELETE FROM invitations WHERE email = ANY($1)`, [[clientEmail, viewerEmail]]);
  await q(`DELETE FROM users WHERE email = ANY($1)`, [[clientEmail, viewerEmail]]);
  await q(`DELETE FROM clients WHERE id = ANY($1)`, [[clients.A.id, clients.B.id]]);
  await db.end();
}
