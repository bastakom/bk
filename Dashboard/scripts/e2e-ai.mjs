/**
 * Röktest för AI-analysen (intern) mot ett produktionsbygge (port 3100) och en simulerad
 * Anthropic-server – ingen riktig AI-nyckel behövs. Skapar en tillfällig kund som väljer
 * byråns synkade källor och tar bort kunden efteråt.
 *   node scripts/e2e-ai.mjs [--shots <katalog>]
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

// Simulerad Anthropic Messages API: sparar anropet och svarar med en analys via verktyget.
const calls = [];
const ANALYSIS = {
  headline: "Stark räckvidd men för dyra leads – flytta budget till de två bästa kampanjerna.",
  status: "blandat",
  summary: "Perioden gav fler visningar till lägre CPM, men CPA ligger över målet.",
  whatWorks: [{ title: "Låg CPM i höstkampanjen", detail: "Billig räckvidd i rätt region.", evidence: "CPM 42 kr (−12 %)" }],
  improvements: [{ title: "Hög CPA i bredare kampanjer", detail: "Smalna av målgruppen.", priority: "hög" }],
  audience: { fit: "delvis", assessment: "Kärnmålgruppen 25–44 nås, men 30 % av budgeten går till 55+.", findings: [{ title: "55+ konverterar sämst", detail: "Exkludera eller sänk bud." }] },
  creatives: [{ ad: "Annons 1", verdict: "Tydlig produkt men svag krok.", suggestion: "Testa en variant med erbjudandet i första bildrutan." }],
  actions: [{ title: "Flytta 20 % av budgeten", detail: "Från bredd till de två kampanjerna med lägst CPA.", priority: "hög", effort: "liten", timeframe: "denna vecka" }],
  budget: "Förbrukningen ligger 8 % under budgettakten.",
  dataGaps: ["Konverteringsvärde saknas i Meta."],
};
const fakeAi = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = JSON.parse(body || "{}");
    calls.push({ path: req.url, key: req.headers["x-api-key"], body: json });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "msg_fake",
        type: "message",
        role: "assistant",
        model: json.model,
        content: [{ type: "tool_use", id: "toolu_fake", name: "lamna_analys", input: ANALYSIS }],
        stop_reason: "tool_use",
        usage: { input_tokens: 12000, output_tokens: 900 },
      }),
    );
  });
});
await new Promise((r) => fakeAi.listen(4012, "127.0.0.1", r));

const db = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const sources = await q(`SELECT a.id, a."workspaceId", a.platform FROM connected_accounts a WHERE "lastSyncedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM creatives c WHERE c."accountId" = a.id AND c."imageData" IS NOT NULL) LIMIT 1`);
if (!sources.length) throw new Error("Behöver en synkad källa med annonsbilder.");
const [src] = sources;
const clientId = `e2e-${randomUUID()}`;
const slug = `e2e-ai-${Date.now()}`;
const dashboardId = `e2e-${randomUUID()}`;
await q(`INSERT INTO clients (id, "workspaceId", name, slug, "updatedAt") VALUES ($1, $2, 'E2E AI', $3, now())`, [clientId, src.workspaceId, slug]);
await q(`INSERT INTO client_sources ("workspaceId", "clientId", "accountId") VALUES ($1, $2, $3)`, [src.workspaceId, clientId, src.id]);
await q(`INSERT INTO dashboards (id, "workspaceId", "clientId", name, settings, "updatedAt") VALUES ($1, $2, $3, 'AI-test', '{}', now())`, [dashboardId, src.workspaceId, clientId]);
const wid = randomUUID();
await q(`INSERT INTO widgets (id, "workspaceId", "clientId", "dashboardId", type, title, config, layout, "updatedAt") VALUES ($1, $2, $3, $4, 'kpi', 'Spend', $5, '{"x":0,"y":0,"w":3,"h":5}', now())`, [
  wid, src.workspaceId, clientId, dashboardId, JSON.stringify({ metrics: ["spend"], sourcePlatforms: [src.platform] }),
]);
await q(`INSERT INTO widget_sources ("workspaceId", "clientId", "widgetId", "accountId") VALUES ($1, $2, $3, $4)`, [src.workspaceId, clientId, wid, src.id]);

const { stop } = await startTestServer(root, { ANTHROPIC_API_KEY: "test-nyckel", ANTHROPIC_BASE_URL: "http://127.0.0.1:4012", AI_MODEL: "claude-opus-5-5" });
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SEED_USER_EMAIL, password: process.env.SEED_USER_PASSWORD }, headers: { origin: base } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Kundens brief
  await page.goto(`${base}/clients/${slug}?tab=profil`);
  await page.getByRole("region", { name: "Kundprofil" }).getByRole("button", { name: "Fyll i" }).click();
  const dlg = page.getByRole("dialog", { name: "Kundprofil" });
  await dlg.getByRole("combobox", { name: "Inriktning" }).click();
  await page.getByRole("option", { name: "Leads" }).click();
  await dlg.getByLabel("Målgrupp").fill("Kvinnor 25–44 i Skåne som planerar renovering");
  await dlg.getByRole("button", { name: "Spara" }).click();
  await dlg.waitFor({ state: "detached" });
  ok(await page.getByText("Kvinnor 25–44 i Skåne som planerar renovering").isVisible(), "Briefen sparas och visas på kundsidan (internt)");
  await shot(page, "ai-brief");

  // Budget som mål (används av AI-analysen)
  await page.getByRole("tab", { name: /Mål och larm/ }).click();
  await page.getByRole("button", { name: "Lägg till mål" }).click();
  const gdlg = page.getByRole("dialog", { name: "Nytt mål" });
  await gdlg.getByRole("combobox", { name: "Metric" }).click();
  await page.getByRole("option", { name: "Spend (budget)" }).click();
  await gdlg.getByLabel(/Målvärde/).fill("50000");
  await gdlg.getByRole("button", { name: "Spara mål" }).click();
  await gdlg.waitFor({ state: "detached" });

  // 2. AI-analys på dashboarden
  await page.goto(`${base}/clients/${slug}/dashboards/${dashboardId}`);
  await page.getByRole("button", { name: "AI-analys" }).click();
  const panel = page.getByRole("dialog", { name: "AI-analys" });
  ok(await panel.getByText("Internt för byrån – visas aldrig för kunden.").isVisible(), "Panelen är märkt som intern");
  await panel.getByRole("button", { name: /^Analysera/ }).click();
  await panel.getByText(ANALYSIS.headline).waitFor({ timeout: 120_000 });
  ok(true, "Analysen visas i panelen");
  for (const s of ["Det här fungerar", "Det här kan bli bättre", "Målgrupp", "Annonser", "Nästa steg för dig", "Budget", "Saknas i underlaget"]) {
    ok(await panel.getByRole("region", { name: s }).isVisible(), `Avsnittet "${s}" visas`);
  }
  await shot(page, "ai-analys");

  // 3. Vad som skickades till AI:n
  const call = calls.at(-1);
  const blocks = call.body.messages[0].content;
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  ok(call.path === "/v1/messages" && call.key === "test-nyckel", "Anropet går till Messages API med nyckeln");
  ok(call.body.model === "claude-opus-5-5" && call.body.tool_choice?.name === "lamna_analys", "Rätt modell och strukturerat svar via verktyg");
  ok(/performance marketing-strateg på en stor digital byrå/.test(call.body.system), "Rollen som performance marketing-strateg");
  ok(text.includes("Kvinnor 25–44 i Skåne") && text.includes("Inriktning: Leads"), "Kundprofilen (inriktning, målgrupp) skickas med");
  ok(/## Kundens mål och budget/.test(text) && /Spend \(budget per månad\): .* av 50\s000\skr/.test(text), "Budgetmålet med utfall skickas med");
  ok(/### Per kampanj/.test(text) && /### Per ålder/.test(text), "Kampanjer och målgruppsfördelning skickas med");
  ok(blocks.some((b) => b.type === "image") && /### Största annonserna/.test(text), "Annonserna skickas med text och bilder");

  // 4. Sparad och intern
  const saved = await q(`SELECT "inputTokens", model FROM ai_insights WHERE "dashboardId" = $1`, [dashboardId]);
  ok(saved.length === 1 && saved[0].inputTokens === 12000, "Analysen sparas med period och tokenförbrukning");
  await page.reload();
  await page.getByRole("button", { name: "AI-analys" }).click();
  await page.getByRole("dialog", { name: "AI-analys" }).getByText(ANALYSIS.headline).waitFor();
  ok(true, "Sparade analyser går att läsa igen");

  const link = await ctx.request.get(`${base}/s/okand-token`);
  ok(link.status() === 404, "Delade länkar har ingen AI-analys (sidan finns bara i appen)");
  ok(errors.length === 0, `Inga JavaScript-fel${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  stop();
  fakeAi.close();
  await q(`DELETE FROM clients WHERE id = $1`, [clientId]);
  await db.end();
}
