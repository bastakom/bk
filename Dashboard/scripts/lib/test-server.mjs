/**
 * Startar ett produktionsbygge av appen på port 3100 som pekar på de
 * simulerade plattformarna (pnpm fake-google + pnpm fake-platforms).
 * .env:s riktiga nycklar påverkas inte. Kräver `pnpm --filter web build`.
 */
import { spawn } from "node:child_process";

export const TEST_BASE = "http://localhost:3100";

export const FAKE_ENV = {
  BETTER_AUTH_URL: TEST_BASE,
  APP_INTERNAL_URL: TEST_BASE,
  GOOGLE_CLIENT_ID: "fake-client-id",
  GOOGLE_CLIENT_SECRET: "fake-client-secret",
  GOOGLE_AUTH_BASE: "http://127.0.0.1:4010",
  GOOGLE_TOKEN_URL: "http://127.0.0.1:4010/token",
  GA4_ADMIN_BASE: "http://127.0.0.1:4010",
  GA4_DATA_BASE: "http://127.0.0.1:4010",
  GOOGLE_ADS_BASE: "http://127.0.0.1:4010",
  META_GRAPH_BASE: "http://127.0.0.1:4011",
  // Tester skickar aldrig riktiga mejl, även om en e-posttjänst är kopplad i .env.
  RESEND_API_KEY: "",
  LINKEDIN_CLIENT_ID: "fake-linkedin-client",
  LINKEDIN_CLIENT_SECRET: "fake-linkedin-secret",
  LINKEDIN_AUTH_BASE: "http://127.0.0.1:4011",
  LINKEDIN_API_BASE: "http://127.0.0.1:4011",
  TIKTOK_APP_ID: "fake-tiktok-app",
  TIKTOK_APP_SECRET: "fake-tiktok-secret",
  TIKTOK_AUTH_BASE: "http://127.0.0.1:4011",
  TIKTOK_API_BASE: "http://127.0.0.1:4011",
};

export async function startTestServer(root, extraEnv = {}) {
  const env = { ...process.env, ...FAKE_ENV, ...extraEnv, PORT: "3100" };
  // Egen processgrupp så att även Next-processen under pnpm stängs efteråt.
  const server = spawn("pnpm", ["--filter", "web", "exec", "next", "start", "-p", "3100"], { cwd: root, env, stdio: "pipe", detached: true });
  const stop = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  };
  process.on("exit", stop);
  for (let i = 0; i < 60; i++) {
    if (await fetch(`${TEST_BASE}/sign-in`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { env, stop };
}
