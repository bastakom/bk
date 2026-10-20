import { timingSafeEqual } from "node:crypto";
import { createOwnerClient } from "@rp/db";
import { runDueSyncJobs } from "@rp/reports";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 60;

/** Kör ett begränsat antal synkjobb. Vercel Cron anropar routen varje minut. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Obehörig" }, { status: 401 });

  const owner = createOwnerClient();
  try {
    const result = await runDueSyncJobs(owner, {
      baseUrl: process.env.APP_INTERNAL_URL ?? process.env.BETTER_AUTH_URL ?? new URL(req.url).origin,
      batch: positiveInt(process.env.SYNC_JOB_BATCH, 6),
      concurrency: positiveInt(process.env.SYNC_JOB_CONCURRENCY, 2),
      log: (message) => console.log(`[cron/sync] ${message}`),
    });
    return NextResponse.json({
      claimed: result.length,
      succeeded: result.filter((job) => job.ok).length,
      split: result.filter((job) => job.split).length,
      failed: result.filter((job) => !job.ok && !job.split).length,
      results: result.map(({ id, accountId, ok, rows, split, error }) => ({ id, accountId, ok, rows, split: split ?? false, error })),
    });
  } finally {
    await owner.$disconnect();
  }
}

/** Stöd även POST så routen kan köras manuellt under test. */
export const POST = GET;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.BETTER_AUTH_SECRET || "";
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  return Boolean(secret) && given.length === expected.length && timingSafeEqual(given, expected);
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
