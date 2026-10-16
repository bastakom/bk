/**
 * Röktest för händelser i grafer och kundens AI-sammanfattning (utkast → publicerad),
 * mot ett produktionsbygge (port 3100) och en simulerad Anthropic-server.
 * Kontrollerar att kunden aldrig ser interna händelser eller utkast.
 *   node scripts/e2e-events-summary.mjs [--shots <katalog>]
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
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

const SUMMARY = "Oktober gick bra mot målen.\n\nHöjdpunkter\n- Lägre kostnad per klick\n- Fler besök från Skåne\n\nDet här gör vi härnäst\n- Testar nya annonsbilder";
const calls = [];
const fakeAi = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = JSON.parse(body || "{}");
    calls.push(json);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "msg", type: "message", role: "assistant", model: json.model, content: [{ type: "tool_use", id: "t", name: json.tool_choice.name, input: { text: SUMMARY } }], stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});
await new Promise((r) => fakeAi.listen(4012, "127.0.0.1", r));

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const [src] = await q(`SELECT id, "workspaceId", platform FROM connected_accounts WHERE "lastSyncedAt" IS NOT NULL AND platform IN ('meta_ads','google_ads') ORDER BY "createdAt" LIMIT 1`);
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-handelser-${Date.now()}`;
const dashboardId = `e2e-${randomUUID()}`;
await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, 'E2E händelser', $3, now())`, [clientId, src.workspaceId, slug]);
await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [src.workspaceId, clientId, src.id]);
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'Händelsetest', '{"range":{"preset":"last_30"}}', now())`, [dashboardId, src.workspaceId, clientId]);
const wid = randomUUID();
await q(`INSERT INTO widgets (id, "workspaceId", "clientId", "dashboardId", type, title, config, layout, "updatedAt") VALUES ($1, $2, $3, $4, 'timeseries', 'Spend över tid', $5, '{"x":0,"y":0,"w":12,"h":10}', now())`, [
  wid, src.workspaceId, clientId, dashboardId, JSON.stringify({ metrics: ["spend"], granularity: "day", sourcePlatforms: [src.platform] }),
]);
await q(`INSERT INTO widget_sources ("workspaceId", "clientId", "widgetId", "accountId") VALUES ($1, $2, $3, $4)`, [src.workspaceId, clientId, wid, src.id]);
const day = (offset) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

const { stop } = await startTestServer(root, { ANTHROPIC_API_KEY: "test-nyckel", ANTHROPIC_BASE_URL: "http://127.0.0.1:4012" });
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const url = `${base}/clients/${slug}/dashboards/${dashboardId}`;
  await page.goto(url);
  await page.waitForSelector(".react-grid-layout");

  // 1. Händelser
  await page.getByRole("button", { name: /^Händelser/ }).click();
  const dlg = page.getByRole("dialog", { name: "Händelser" });
  const add = async (date, text, internal) => {
    await dlg.getByLabel("Datum").fill(date);
    await dlg.getByLabel("Vad hände?").fill(text);
    if (internal) await dlg.getByLabel(/Intern/).check();
    await dlg.getByRole("button", { name: "Lägg till händelse" }).click();
    await dlg.getByText(text).waitFor();
    if (internal) await dlg.getByLabel(/Intern/).uncheck();
  };
  await add(day(20), "Höstkampanjen startade", false);
  await add(day(10), "Budgeten sänktes tillfälligt", true);
  await page.keyboard.press("Escape");
  const chart = page.getByRole("region", { name: "Spend över tid" });
  const events = chart.getByRole("list", { name: "Händelser i grafen" });
  await events.waitFor();
  ok((await events.getByRole("listitem").count()) === 2, "Båda händelserna markeras i trendgrafen för byrån");
  ok(await events.getByText("intern").isVisible(), "Interna händelser är märkta");
  await shot(page, "handelser");

  // 2. Sammanfattning med AI-utkast
  await page.getByRole("button", { name: "Redigera" }).click();
  await page.getByRole("button", { name: "Lägg till widget" }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("button", { name: "Sammanfattning", exact: true }).click();
  await editor.getByRole("button", { name: "Skriv utkast med AI" }).click();
  await editor.getByLabel("Text", { exact: true }).and(page.locator("textarea")).waitFor();
  await page.waitForFunction(() => document.querySelector("#w-summary")?.value.includes("Oktober gick bra"), null, { timeout: 60_000 });
  ok(true, "AI skriver ett utkast som kan redigeras");
  const req = calls.at(-1);
  ok(req.tool_choice.name === "lamna_sammanfattning" && /sammanfattning till byråns kund/.test(req.system), "Kundvänlig prompt (inte den interna analysen)");
  const sent = req.messages[0].content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  ok(sent.includes("Höstkampanjen startade") && sent.includes("(intern – nämn inte för kunden)"), "Händelserna skickas med, interna märkta");
  await editor.getByRole("button", { name: /Lägg till|Spara/ }).last().click();
  await editor.waitFor({ state: "detached" });
  const summary = page.getByRole("region", { name: "Sammanfattning" });
  await summary.getByText(/Utkast – syns inte för kunden/).waitFor();
  ok(true, "Utkastet är märkt i appen");
  await page.getByRole("button", { name: "Klar" }).click();

  // 3. Kunden: delad länk
  await page.getByRole("button", { name: /Dela och exportera/ }).click();
  await page.getByRole("menuitem", { name: /Dela länk med kunden/ }).click();
  await page.getByLabel("Namn (för er)").fill("Händelsetest");
  await page.getByRole("button", { name: "Skapa länk" }).click();
  const linkInput = page.getByLabel(/Länk Händelsetest/);
  await linkInput.waitFor();
  const shareUrl = (await linkInput.inputValue()).replace(/^https?:\/\/[^/]+/, base);
  await page.keyboard.press("Escape");
  const guest = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.goto(shareUrl);
  await guest.waitForSelector(".react-grid-layout");
  const gEvents = guest.getByRole("list", { name: "Händelser i grafen" });
  await gEvents.waitFor();
  ok((await gEvents.getByRole("listitem").count()) === 1 && (await gEvents.getByText("Höstkampanjen startade").count()) === 1, "Kunden ser bara den icke-interna händelsen");
  ok((await guest.getByText("Budgeten sänktes tillfälligt").count()) === 0, "Den interna händelsen syns inte för kunden");
  ok((await guest.getByText("Oktober gick bra mot målen.").count()) === 0, "Utkastet syns inte för kunden");

  // 4. Publicera
  await page.getByRole("button", { name: "Redigera" }).click();
  await page.getByRole("region", { name: "Sammanfattning" }).getByRole("button", { name: "Redigera widget" }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: /Publicerad/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Spara/ }).last().click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await guest.reload();
  await guest.getByText("Oktober gick bra mot målen.").waitFor({ timeout: 30_000 });
  ok((await guest.getByText(/Utkast – syns inte/).count()) === 0, "Publicerad sammanfattning syns för kunden, utan utkastmärkning");
  await shot(guest, "sammanfattning-kund");

  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  fakeAi.close();
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await db.end();
}
