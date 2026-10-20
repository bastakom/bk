import { addDays, todayInTimezone, type DimensionId } from "@rp/core";
import { getConnector } from "@rp/core/server";
import type { PrismaClient, SyncJobStatus } from "./generated/prisma/client";

export type SyncJobDimension = "" | DimensionId;
export type SyncJobRecord = {
  id: string; workspaceId: string; accountId: string; dimension: SyncJobDimension;
  rangeStart: Date; rangeEnd: Date; status: SyncJobStatus; attempts: number;
  runAfter: Date; lockedAt: Date | null; startedAt: Date | null; finishedAt: Date | null;
  rowsWritten: number; error: string | null;
};
type QueueDb = Pick<PrismaClient, "connectedAccount" | "syncJob">;

export interface EnqueueAccountHistoryOptions {
  days?: number; chunkDays?: number; dimensions?: SyncJobDimension[];
}

export const DEFAULT_HISTORY_DAYS = 1100;
export const DEFAULT_JOB_CHUNK_DAYS = 30;
export const STALE_JOB_MINUTES = 15;

const dateAtUtcMidnight = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** Skapar historikjobb idempotent. Nyaste intervallen får lägst sorteringsålder. */
export async function enqueueAccountHistory(db: QueueDb, accountId: string, opts: EnqueueAccountHistoryOptions = {}) {
  const account = await db.connectedAccount.findUniqueOrThrow({
    where: { id: accountId }, select: { id: true, workspaceId: true, timezone: true, connectorId: true },
  });
  const days = Math.max(1, Math.floor(opts.days ?? DEFAULT_HISTORY_DAYS));
  const chunkDays = Math.max(1, Math.floor(opts.chunkDays ?? DEFAULT_JOB_CHUNK_DAYS));
  const connector = getConnector(account.connectorId);
  const dimensions = opts.dimensions ?? ["", ...connector.availableDimensions().filter((d) => d !== "date")];
  const end = todayInTimezone(account.timezone);
  const start = addDays(end, -(days - 1));
  const data: Array<{ id: string; workspaceId: string; accountId: string; dimension: string; rangeStart: Date; rangeEnd: Date }> = [];

  for (const dimension of [...new Set(dimensions)]) {
    for (let cursor = end; cursor >= start; cursor = addDays(cursor, -chunkDays)) {
      const candidateStart = addDays(cursor, -(chunkDays - 1));
      const rangeStart = candidateStart < start ? start : candidateStart;
      data.push({ id: `sj_${crypto.randomUUID()}`, workspaceId: account.workspaceId, accountId,
        dimension, rangeStart: dateAtUtcMidnight(rangeStart), rangeEnd: dateAtUtcMidnight(cursor) });
    }
  }
  if (!data.length) return { created: 0, existing: 0 };
  const result = await db.syncJob.createMany({ data, skipDuplicates: true });
  return { created: result.count, existing: data.length - result.count };
}

/** Tar nästa körbara jobb atomiskt. Övergivna RUNNING-jobb kan tas över. */
export async function claimSyncJobs(owner: PrismaClient, limit = 1, now = new Date()): Promise<SyncJobRecord[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const stale = new Date(now.getTime() - STALE_JOB_MINUTES * 60_000);
  return owner.$queryRaw<SyncJobRecord[]>`
    UPDATE "sync_jobs" AS j
    SET "status" = 'RUNNING', "lockedAt" = ${now},
        "startedAt" = COALESCE(j."startedAt", ${now}), "attempts" = j."attempts" + 1,
        "updatedAt" = ${now}
    WHERE j."id" IN (
      SELECT q."id" FROM "sync_jobs" AS q
      WHERE (q."status" = 'PENDING' AND q."runAfter" <= ${now})
         OR (q."status" = 'RUNNING' AND q."lockedAt" < ${stale})
      ORDER BY q."rangeEnd" DESC, q."rangeStart" DESC, q."createdAt" ASC
      LIMIT ${safeLimit} FOR UPDATE SKIP LOCKED
    )
    RETURNING j.*`;
}

export async function finishSyncJob(owner: PrismaClient, id: string, rowsWritten: number) {
  await owner.syncJob.update({ where: { id }, data: { status: "SUCCESS", rowsWritten, finishedAt: new Date(), lockedAt: null, error: null } });
}

export async function failSyncJob(owner: PrismaClient, id: string, error: string, retryAt: Date | null) {
  await owner.syncJob.update({ where: { id }, data: {
    status: retryAt ? "PENDING" : "FAILED", runAfter: retryAt ?? undefined, lockedAt: null,
    error: error.slice(0, 4000), finishedAt: retryAt ? null : new Date(),
  } });
}

/** Ersätter ett tungt jobb med två exakta, angränsande intervall. */
export async function splitSyncJob(owner: PrismaClient, job: SyncJobRecord) {
  const start = job.rangeStart.toISOString().slice(0, 10);
  const end = job.rangeEnd.toISOString().slice(0, 10);
  const totalDays = daysInclusive(start, end);
  if (totalDays <= 1) return null;
  const leftEnd = addDays(end, -Math.ceil(totalDays / 2));
  const rightStart = addDays(leftEnd, 1);
  const leftId = `sj_${crypto.randomUUID()}`;
  const rightId = `sj_${crypto.randomUUID()}`;
  await owner.$transaction(async (tx) => {
    await tx.syncJob.delete({ where: { id: job.id } });
    await tx.syncJob.createMany({ data: [
      { id: leftId, workspaceId: job.workspaceId, accountId: job.accountId, dimension: job.dimension, rangeStart: dateAtUtcMidnight(start), rangeEnd: dateAtUtcMidnight(leftEnd) },
      { id: rightId, workspaceId: job.workspaceId, accountId: job.accountId, dimension: job.dimension, rangeStart: dateAtUtcMidnight(rightStart), rangeEnd: dateAtUtcMidnight(end) },
    ] });
  });
  return { leftId, rightId };
}

export async function finalizeAccountIfComplete(owner: PrismaClient, accountId: string) {
  const remaining = await owner.syncJob.count({ where: { accountId, status: { in: ["PENDING", "RUNNING", "FAILED"] } } });
  const total = await owner.syncJob.count({ where: { accountId } });
  if (total > 0 && remaining === 0) {
    await owner.connectedAccount.update({ where: { id: accountId }, data: { status: "OK", statusMessage: null, lastSyncedAt: new Date() } });
    return true;
  }
  return false;
}

export function daysInclusive(start: string, end: string) {
  return Math.max(1, Math.round((dateAtUtcMidnight(end).getTime() - dateAtUtcMidnight(start).getTime()) / 86_400_000) + 1);
}
