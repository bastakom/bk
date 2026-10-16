/**
 * Tar helsidesskärmdumpar av appen som inloggad seed-användare.
 *   node scripts/screenshot.mjs <sökväg> <utfil.png> [--width 1440] [--dark] [--full]
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const [path, out, ...rest] = process.argv.slice(2);
const flag = (n) => rest.includes(n);
const opt = (n, d) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : d);
const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: Number(opt("--width", 1440)), height: Number(opt("--height", 900)) },
  deviceScaleFactor: 2,
  colorScheme: flag("--dark") ? "dark" : "light",
});
const page = await ctx.newPage();
const res = await page.request.post(`${base}/api/auth/sign-in/email`, {
  data: { email: opt("--user", process.env.SEED_USER_EMAIL), password: process.env.SEED_USER_PASSWORD },
  headers: { origin: base },
});
if (!res.ok()) throw new Error(`Inloggning misslyckades: ${res.status()}`);
await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(opt("--wait", 800)));
const segments = Number(opt("--segments", 0));
if (segments > 0) {
  // Dela upp långa sidor i flera bilder (out-1.png, out-2.png, …).
  // Gör fönstret lika högt som sidan (bredden oförändrad) och klipp ut delar.
  const { width, height } = page.viewportSize();
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: total });
  await page.waitForTimeout(800);
  for (let i = 0; i < segments && i * height < total; i++) {
    await page.screenshot({ path: out.replace(/\.png$/, `-${i + 1}.png`), clip: { x: 0, y: i * height, width, height: Math.min(height, total - i * height) } });
  }
} else {
  await page.screenshot({ path: out, fullPage: flag("--full") });
}
await browser.close();
console.log(`Sparad: ${out}`);
