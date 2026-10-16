/**
 * Demodata: en byrå, tre användare (admin/redaktör/läsare), fem kunder med
 * mockkopplade konton i olika status, några dashboards och två års synkad
 * mockdata. Kan köras om – byrån raderas och skapas på nytt.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });

const { hashPassword } = await import("better-auth/crypto");
const { encryptSecret, getConnector } = await import("@rp/core/server");
const { createOwnerClient, discoverSources, ownerRunner, syncAccount, dashboardToDefinition, syncFxRates } = await import("../src/index");
const { seedAnnualReport, seedOverview } = await import("./seed-dashboards");

const prisma = createOwnerClient();
const SLUG = "bastakompisar";
const password = process.env.SEED_USER_PASSWORD;
const adminEmail = process.env.SEED_USER_EMAIL ?? "demo@bastakompisar.se";
if (!password) throw new Error("SEED_USER_PASSWORD saknas i .env");

async function upsertUser(email: string, name: string) {
  const user = await prisma.user.upsert({
    where: { email },
    create: { id: crypto.randomUUID(), email, name, emailVerified: true },
    update: { name },
  });
  await prisma.authAccount.deleteMany({ where: { userId: user.id, providerId: "credential" } });
  await prisma.authAccount.create({
    data: { id: crypto.randomUUID(), accountId: user.id, providerId: "credential", userId: user.id, password: await hashPassword(password!) },
  });
  return user;
}

type Plan = {
  name: string;
  primaryColor: string;
  accentColor: string;
  accounts: { connector: string; externalId: string }[];
  dashboards: string[];
};

const CLIENTS: Plan[] = [
  {
    name: "Demo Finans",
    primaryColor: "#0F2A44",
    accentColor: "#C8A96A",
    accounts: [
      { connector: "mock_ga4", externalId: "properties/312450981" },
      { connector: "mock_google_ads", externalId: "123-456-7890" },
      { connector: "mock_google_ads", externalId: "987-654-3210" },
      { connector: "mock_linkedin_ads", externalId: "urn:li:sponsoredAccount:508812341" },
    ],
    dashboards: ["Månadsrapport", "LinkedIn – målgrupper"],
  },
  {
    name: "Demo Fastighetsförmedling",
    primaryColor: "#14352B",
    accentColor: "#84CC16",
    accounts: [
      { connector: "mock_ga4", externalId: "properties/298110433" },
      { connector: "mock_meta_ads", externalId: "act_1029384756" },
      { connector: "mock_meta_ads", externalId: "act_5566778899-expired" },
      { connector: "mock_tiktok_ads", externalId: "7301122334455667788" },
    ],
    dashboards: ["Social översikt", "Månadsrapport"],
  },
  {
    name: "Demo Tandvård",
    primaryColor: "#0E4D64",
    accentColor: "#38BDF8",
    accounts: [
      { connector: "mock_ga4", externalId: "properties/312450982" },
      { connector: "mock_google_ads", externalId: "123-456-7891" },
      { connector: "mock_meta_ads", externalId: "act_1029384757" },
      { connector: "mock_linkedin_ads", externalId: "urn:li:sponsoredAccount:508812342" },
    ],
    dashboards: ["Leads & bokningar"],
  },
  {
    name: "Demo Cykelverkstad",
    primaryColor: "#3F2D20",
    accentColor: "#F97316",
    accounts: [
      { connector: "mock_google_ads", externalId: "555-010-2020-broken" },
      { connector: "mock_tiktok_ads", externalId: "7301122334455667799" },
    ],
    dashboards: ["Kampanjrapport vår"],
  },
  { name: "Demo Byggkonsult", primaryColor: "#1E293B", accentColor: "#A855F7", accounts: [], dashboards: [] },
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

console.time("seed");

// Valutakurser från ECB (globala, behålls mellan körningar).
const latestFx = await prisma.fxRate.findFirst({ orderBy: { date: "desc" } });
try {
  const from = latestFx ? latestFx.date.toISOString().slice(0, 10) : "2023-01-01";
  console.log(`  ECB-kurser: ${await syncFxRates(prisma, from)} hämtade från ${from}`);
} catch (e) {
  console.warn(`  Kunde inte hämta ECB-kurser (${e instanceof Error ? e.message : e}). Belopp i andra valutor visas utan omräkning.`);
}

await prisma.workspace.deleteMany({ where: { slug: SLUG } });

const admin = await upsertUser(adminEmail, "Alex (demo)");
const editor = await upsertUser("redaktor@bastakompisar.se", "Robin Redaktör");
const viewer = await upsertUser("lasare@bastakompisar.se", "Lo Läsare");

const ws = await prisma.workspace.create({
  data: {
    name: "Reklambyrån Bästa Kompisar",
    slug: SLUG,
    // Varumärke från bastakompisar.se: navy, Figtree (nära Sofia Pro) och BK-loggan.
    brandColor: "#25364F",
    fontFamily: "Figtree",
    logoUrl: `data:image/png;base64,${readFileSync(resolve(import.meta.dirname, "../../../apps/web/public/brand/bk-logo.png")).toString("base64")}`,
    memberships: {
      create: [
        { userId: admin.id, role: "ADMIN" },
        { userId: editor.id, role: "EDITOR" },
        { userId: viewer.id, role: "VIEWER" },
      ],
    },
  },
});

// En OAuth-inloggning per plattform, delad av byråns kunder.
const connections = new Map<string, string>();
for (const connectorId of new Set(CLIENTS.flatMap((c) => c.accounts.map((a) => a.connector)))) {
  const connector = getConnector(connectorId);
  const conn = await prisma.connection.create({
    data: {
      workspaceId: ws.id,
      connectorId,
      platform: connector.platform,
      label: "marknad@bastakompisar.se",
      scopes: connector.auth.scopes,
      encryptedTokens: encryptSecret(JSON.stringify({ accessToken: `seed-${connectorId}`, expiresAt: Date.now() + 3600_000 })),
      createdById: admin.id,
    },
  });
  connections.set(connectorId, conn.id);
}

const created: Record<string, { clientId: string; accounts: Record<string, string> }> = {};

for (const plan of CLIENTS) {
  const client = await prisma.client.create({
    data: { workspaceId: ws.id, name: plan.name, slug: slugify(plan.name), primaryColor: plan.primaryColor, accentColor: plan.accentColor },
  });
  for (const a of plan.accounts) {
    const connector = getConnector(a.connector);
    const ext = (await connector.listAccounts({ tokens: { accessToken: "" } })).find((x) => x.externalId === a.externalId)!;
    const account = await prisma.connectedAccount.create({
      data: {
        workspaceId: ws.id,
        connectionId: connections.get(a.connector)!,
        connectorId: a.connector,
        platform: connector.platform,
        externalId: ext.externalId,
        name: ext.name,
        currency: ext.currency ?? "SEK",
        timezone: ext.timezone ?? "Europe/Stockholm",
        clientSources: { create: { workspaceId: ws.id, clientId: client.id } },
      },
    });
    created[plan.name] ??= { clientId: client.id, accounts: {} };
    created[plan.name]!.accounts[a.externalId] = account.id;
    const res = await syncAccount(prisma, account.id, { days: 1100 });
    console.log(`  ${plan.name} · ${connector.label} · ${ext.name}: ${res.ok ? `${res.rowsWritten} rader` : `FEL – ${res.error}`}`);
  }
  for (const name of plan.dashboards) {
    await prisma.dashboard.create({ data: { workspaceId: ws.id, clientId: client.id, name } });
  }
}

// Övriga konton som inloggningarna ger åtkomst till syns i Databaser (inte valda av någon kund, synkas inte).
for (const connectionId of connections.values()) await discoverSources(ownerRunner(prisma), connectionId);

// Byråns egna metrics (blended)
await prisma.customMetric.createMany({
  data: [
    { workspaceId: ws.id, key: "total_roas", name: "Total ROAS", formula: "conversion_value / spend", format: "number", higherIsBetter: true, description: "Allt konverteringsvärde delat med all spend i valda källor." },
    { workspaceId: ws.id, key: "kostnad_per_besok", name: "Kostnad per besök", formula: "spend / sessions[ga4]", format: "currency", higherIsBetter: false, description: "All annonsspend delat med besök enligt GA4." },
    { workspaceId: ws.id, key: "blended_cpa", name: "Blended CPA", formula: "spend / conversions[ga4]", format: "currency", higherIsBetter: false, description: "All spend delat med konverteringar enligt GA4 (undviker dubbelräkning)." },
  ],
});

// Årsrapport för Demo Finans (speglar referens-PDF:en), sparad även som mall.
const kg = created["Demo Finans"]!;
const annual = await prisma.dashboard.create({
  data: {
    workspaceId: ws.id,
    clientId: kg.clientId,
    name: "Årsrapport",
    settings: { range: { preset: "last_year" }, compare: "previous_period" },
  },
});
await seedAnnualReport(prisma, {
  workspaceId: ws.id,
  clientId: kg.clientId,
  dashboardId: annual.id,
  accounts: {
    ga4: kg.accounts["properties/312450981"],
    google_ads: kg.accounts["123-456-7890"],
    linkedin_ads: kg.accounts["urn:li:sponsoredAccount:508812341"],
  },
});
await prisma.dashboardTemplate.create({
  data: {
    workspaceId: ws.id,
    name: "Årsrapport – GA4, LinkedIn och Google Ads",
    description: "Samma struktur som Demo Finans årsrapport. Mappa GA4-, LinkedIn- och Google Ads-konto.",
    definition: JSON.parse(JSON.stringify(await dashboardToDefinition(prisma, annual.id))),
  },
});
const overview = await prisma.dashboard.create({
  data: { workspaceId: ws.id, clientId: kg.clientId, name: "Alla kanaler", settings: { range: { preset: "last_90" }, compare: "previous_period" } },
});
await seedOverview(prisma, {
  workspaceId: ws.id,
  clientId: kg.clientId,
  dashboardId: overview.id,
  accounts: {
    ga4: kg.accounts["properties/312450981"],
    google_ads: kg.accounts["123-456-7890"],
    google_ads_usd: kg.accounts["987-654-3210"],
    linkedin_ads: kg.accounts["urn:li:sponsoredAccount:508812341"],
  },
});
console.log("  Årsrapport, Alla kanaler och mall skapade");

console.timeEnd("seed");
console.log(`\nKlart. Logga in med ${adminEmail} (lösenord från SEED_USER_PASSWORD i .env).`);
await prisma.$disconnect();
