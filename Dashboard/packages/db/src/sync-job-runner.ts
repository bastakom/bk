import { ConnectorAuthError, mergeDuplicateRows, type DimensionId, type TokenSet } from "@rp/core";
import { decryptSecret, encryptSecret, getConnector } from "@rp/core/server";
import type { PrismaClient } from "./generated/prisma/client";
import { failSyncJob, finalizeAccountIfComplete, finishSyncJob, splitSyncJob, type SyncJobRecord } from "./sync-queue";

const ROW_BATCH = 2000;
const REFRESH_MARGIN_MS = 5 * 60_000;
const MIN_SPLIT_DAYS = 1;

export interface SyncJobResult {
  ok: boolean;
  rowsWritten: number;
  error?: string;
  auth?: boolean;
  split?: boolean;
}

/** Kör exakt ett intervall. Nätverk ligger utanför den korta skrivtransaktionen. */
export async function runSyncJob(owner: PrismaClient, job: SyncJobRecord): Promise<SyncJobResult> {
  const account = await owner.connectedAccount.findUniqueOrThrow({ where: { id: job.accountId }, include: { connection: true } });
  const connector = getConnector(account.connectorId);
  const dimension = job.dimension as DimensionId | "";
  const dateRange = { start: isoDate(job.rangeStart), end: isoDate(job.rangeEnd) };
  const external = { externalId: account.externalId, name: account.name, currency: account.currency, timezone: account.timezone };
  const oauth = connector.auth.type === "oauth2" && !connector.isMock ? connector.auth : null;

  let tokens = JSON.parse(decryptSecret(account.connection.encryptedTokens)) as TokenSet;
  const persistTokens = async (next: TokenSet) => owner.connection.update({
    where: { id: account.connectionId }, data: { encryptedTokens: encryptSecret(JSON.stringify(next)), status: "ACTIVE" },
  });

  try {
    if (oauth && tokens.expiresAt && tokens.expiresAt < Date.now() + REFRESH_MARGIN_MS) {
      tokens = await oauth.refresh(tokens);
      await persistTokens(tokens);
    }

    let result;
    try {
      result = await fetchJob(connector, tokens, external, dimension, dateRange);
    } catch (error) {
      if (error instanceof ConnectorAuthError && error.reason === "expired" && oauth) {
        tokens = await oauth.refresh(tokens);
        await persistTokens(tokens);
        result = await fetchJob(connector, tokens, external, dimension, dateRange);
      } else throw error;
    }

    const rows = mergeDuplicateRows(result.rows).map((row) => ({
      workspaceId: account.workspaceId, accountId: account.id, date: new Date(`${row.date}T00:00:00.000Z`),
      dimension, dimensionValue: dimension ? row.dims[dimension] ?? "(saknas)" : "", currency: result.currency, metrics: row.metrics,
    }));
    await owner.$transaction(async (tx) => {
      await tx.metricFact.deleteMany({ where: { accountId: account.id, dimension, date: { gte: new Date(`${dateRange.start}T00:00:00.000Z`), lte: new Date(`${dateRange.end}T00:00:00.000Z`) } } });
      for (let i = 0; i < rows.length; i += ROW_BATCH) await tx.metricFact.createMany({ data: rows.slice(i, i + ROW_BATCH) });
    });
    await finishSyncJob(owner, job.id, rows.length);
    await finalizeAccountIfComplete(owner, account.id);
    return { ok: true, rowsWritten: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isSplittableError(error) && daysBetween(job) > MIN_SPLIT_DAYS) {
      await splitSyncJob(owner, job);
      return { ok: false, rowsWritten: 0, error: message, split: true };
    }
    const auth = error instanceof ConnectorAuthError;
    const retryAt = auth ? null : retryDate(job, error);
    await failSyncJob(owner, job.id, message, retryAt);
    await owner.connectedAccount.update({ where: { id: account.id }, data: auth ? { status: "AUTH_REQUIRED", statusMessage: message } : { status: retryAt ? "PENDING" : "SYNC_ERROR", statusMessage: message } });
    if (auth && error.scope === "connection" && !connector.isMock) {
      await owner.connection.update({ where: { id: account.connectionId }, data: { status: "AUTH_REQUIRED" } });
      await owner.connectedAccount.updateMany({ where: { connectionId: account.connectionId }, data: { status: "AUTH_REQUIRED", statusMessage: message } });
    }
    return { ok: false, rowsWritten: 0, error: message, auth };
  }
}

async function fetchJob(connector: ReturnType<typeof getConnector>, tokens: TokenSet, account: { externalId: string; name: string; currency: string; timezone: string }, dimension: DimensionId | "", dateRange: { start: string; end: string }) {
  return connector.fetch({ tokens }, { account, metrics: connector.availableMetrics(), dimensions: dimension ? [dimension] : [], dateRange });
}

function isoDate(value: Date) { return value.toISOString().slice(0, 10); }
function daysBetween(job: SyncJobRecord) { return Math.round((job.rangeEnd.getTime() - job.rangeStart.getTime()) / 86_400_000) + 1; }

function isSplittableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /kod\s*2|error\s*code\s*2|too\s*large|too\s*many|tung|insufficient|timeout|timed\s*out/i.test(message);
}

function retryDate(job: SyncJobRecord, error: unknown): Date | null {
  if (job.attempts >= 6) return null;
  const message = error instanceof Error ? error.message : String(error);
  if (!/kod\s*1|fetch failed|network|socket|rate|tempor|429|5\d\d/i.test(message)) return null;
  return new Date(Date.now() + Math.min(30, 2 ** Math.max(0, job.attempts - 1)) * 60_000);
}
