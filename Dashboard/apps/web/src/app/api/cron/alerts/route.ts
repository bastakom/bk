import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDueAlerts } from "@/lib/alerts";

/**
 * Kör förfallna larmregler. Anropas av workern varje minut (reglerna kontrolleras
 * högst en gång per timme). Skyddas med CRON_SECRET (eller appens hemlighet).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.BETTER_AUTH_SECRET || "";
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const expected = Buffer.from(secret);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Obehörig" }, { status: 401 });
  const results = await runDueAlerts();
  return NextResponse.json({ checked: results.length, triggered: results.filter((r) => r.triggered).length, notified: results.filter((r) => r.notified).length, errors: results.filter((r) => r.error).length });
}
