/**
 * Bakgrundsworker. Varje minut:
 *  - synkar konton vars senaste synk är äldre än SYNC_INTERVAL_HOURS (standard 4 h),
 *  - skickar förfallna schemalagda rapporter,
 *  - hämtar nya ECB-kurser när de är äldre än ett dygn,
 *  - kontrollerar larmregler (högst en gång per timme och regel, via webbappen).
 * Flera instanser kan köras samtidigt – konton och scheman låses atomiskt i databasen.
 *
 *   pnpm worker          # kör tills den stoppas
 *   pnpm worker --once   # en körning, t.ex. från cron
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const { createOwnerClient } = await import("@rp/db");
const { closeBrowser, runDueSchedules, runDueSyncs, syncFxIfStale } = await import("@rp/reports");

const prisma = createOwnerClient();
const baseUrl = process.env.APP_INTERNAL_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error("BETTER_AUTH_SECRET saknas");

const log = (msg: string) => console.log(`[worker ${new Date().toISOString()}] ${msg}`);

let running = false;

async function tick() {
  // En körning i taget per process; långa synkar får inte staplas på varandra.
  if (running) return;
  running = true;
  try {
    await step("valutakurser", () => syncFxIfStale(prisma, log));
    await step("synk", async () => {
      const res = await runDueSyncs(prisma, { baseUrl, log });
      if (res.length) log(`Synk: ${res.filter((r) => r.ok).length} lyckade, ${res.filter((r) => !r.ok).length} misslyckade`);
    });
    await step("utskick", async () => {
      const res = await runDueSchedules(prisma, { baseUrl, secret: secret!, db: (fn) => fn(prisma), log });
      if (res.length) log(`Utskick: ${res.filter((r) => r.ok).length} skickade, ${res.filter((r) => !r.ok).length} misslyckade`);
    });
    await step("larm", async () => {
      // Larmen beräknas i webbappen (samma dataladdning som dashboards).
      const res = await fetch(`${baseUrl}/api/cron/alerts`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET || secret}` }, signal: AbortSignal.timeout(300_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const r = (await res.json()) as { checked: number; notified: number; errors: number };
      if (r.checked) log(`Larm: ${r.checked} kontrollerade, ${r.notified} mejlade${r.errors ? `, ${r.errors} fel` : ""}`);
    });
  } finally {
    running = false;
  }
}

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    log(`Fel i ${name}: ${e instanceof Error ? e.message : e}`);
  }
}

if (process.argv.includes("--once")) {
  await tick();
  await closeBrowser();
  await prisma.$disconnect();
} else {
  log(`Startad. Synk var ${process.env.SYNC_INTERVAL_HOURS ?? 4}:e timme, utskick och kurser kontrolleras varje minut (${baseUrl}).`);
  await tick();
  const timer = setInterval(tick, 60_000);
  const stop = async () => {
    clearInterval(timer);
    await closeBrowser();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
