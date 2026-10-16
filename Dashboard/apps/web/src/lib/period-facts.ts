/**
 * Periodvärden (t.ex. räckvidd = unika personer) går inte att summera dag för dag.
 * De hämtas från plattformen för exakt den period och de filter som rapporten visar,
 * och sparas som cache i period_facts:
 *  - avslutade perioder (slutar mer än 3 dagar bakåt) hämtas en gång,
 *  - pågående perioder hämtas om efter 6 timmar.
 * Går hämtningen inte (t.ex. ingen nätverksåtkomst) används äldre cache om den finns.
 */
import "server-only";
import { addDays, type DataFilter, type DateRange, type DimensionId, type MetricId, type PlatformId, type TokenSet } from "@rp/core";
import { decryptSecret, encryptSecret, getConnector } from "@rp/core/server";
import type { Prisma, TenantTx } from "@rp/db";
import { createHash } from "node:crypto";
import type { FactRow } from "@rp/core";

const STALE_MS = 6 * 3600_000;
/** Filter som plattformen själv kan tillämpa (Meta: kampanj, annonsgrupp, annons). */
const PLATFORM_FILTER_DIMS: DimensionId[] = ["campaign", "ad_set", "ad"];

export interface PeriodRequest {
  accounts: { id: string; platform: PlatformId; filters: DataFilter[] }[];
  metrics: MetricId[];
  /** Uppdelning (t.ex. ålder), undefined = totalt */
  dimension?: DimensionId;
  range: DateRange;
  today: string;
}

export interface PeriodResult {
  rows: FactRow[];
  /** Källor där värdet inte kunde räknas (t.ex. filter som plattformen inte stöder). */
  skipped: { accountId: string; reason: "filter" | "error" }[];
}

const filterKey = (filters: DataFilter[]) =>
  filters.length ? createHash("sha256").update(JSON.stringify(filters.map((f) => [f.dimension, f.op, [...f.values].sort()]))).digest("hex").slice(0, 16) : "";

export async function loadPeriodRows(tx: TenantTx, req: PeriodRequest): Promise<PeriodResult> {
  const out: PeriodResult = { rows: [], skipped: [] };
  const settled = addDays(req.range.end, 3) < req.today;
  for (const a of req.accounts) {
    // Filter på samma dimension som uppdelningen tillämpas här; kampanj/annonsgrupp/annons av plattformen.
    const local = a.filters.filter((f) => f.dimension === req.dimension && !PLATFORM_FILTER_DIMS.includes(f.dimension));
    const remote = a.filters.filter((f) => PLATFORM_FILTER_DIMS.includes(f.dimension));
    if (a.filters.some((f) => !local.includes(f) && !remote.includes(f))) {
      out.skipped.push({ accountId: a.id, reason: "filter" });
      continue;
    }
    const key = { accountId: a.id, dimension: req.dimension ?? "", filterKey: filterKey(remote), start: new Date(req.range.start), end: new Date(req.range.end) };
    const cached = await tx.periodFact.findUnique({ where: { accountId_dimension_filterKey_start_end: key } });
    const fresh = cached && (settled ? cached.fetchedAt.toISOString().slice(0, 10) > addDays(req.range.end, 2) : Date.now() - cached.fetchedAt.getTime() < STALE_MS);
    let rows = cached?.rows as { value: string; metrics: Record<string, number> }[] | undefined;
    if (!fresh) {
      try {
        rows = await fetchFromPlatform(tx, a.id, req, remote);
        await tx.periodFact.upsert({
          where: { accountId_dimension_filterKey_start_end: key },
          create: { ...key, workspaceId: (await tx.connectedAccount.findUniqueOrThrow({ where: { id: a.id }, select: { workspaceId: true } })).workspaceId, rows: rows as Prisma.InputJsonValue },
          update: { rows: rows as Prisma.InputJsonValue, fetchedAt: new Date() },
        });
      } catch (err) {
        console.error(JSON.stringify({ event: "period_fetch_failed", account: a.id, error: err instanceof Error ? err.message.slice(0, 200) : String(err) }));
        if (!rows) {
          out.skipped.push({ accountId: a.id, reason: "error" });
          continue;
        }
      }
    }
    for (const r of rows ?? []) {
      if (local.length && !local.every((f) => (f.op === "in" ? f.values.includes(r.value) : f.op === "not_in" ? !f.values.includes(r.value) : f.op === "contains" ? f.values.some((v) => r.value.toLowerCase().includes(v.toLowerCase())) : !f.values.some((v) => r.value.toLowerCase().includes(v.toLowerCase())))))
        continue;
      const metrics = Object.fromEntries(req.metrics.filter((m) => typeof r.metrics[m] === "number").map((m) => [m, r.metrics[m]!]));
      out.rows.push({ accountId: a.id, platform: a.platform, date: req.range.start, dimensionValue: r.value, metrics, period: true });
    }
  }
  return out;
}

async function fetchFromPlatform(tx: TenantTx, accountId: string, req: PeriodRequest, filters: DataFilter[]) {
  const acc = await tx.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { externalId: true, name: true, currency: true, timezone: true, connectorId: true, connectionId: true, connection: { select: { encryptedTokens: true } } },
  });
  const connector = getConnector(acc.connectorId);
  if (!connector.fetchPeriod) throw new Error(`${connector.label} har inga periodvärden.`);
  let tokens = JSON.parse(decryptSecret(acc.connection.encryptedTokens)) as TokenSet;
  if (connector.auth.type === "oauth2" && tokens.expiresAt && tokens.expiresAt < Date.now() + 60_000) {
    tokens = await connector.auth.refresh(tokens);
    await tx.connection.update({ where: { id: acc.connectionId }, data: { encryptedTokens: encryptSecret(JSON.stringify(tokens)) } });
  }
  const res = await connector.fetchPeriod(
    { tokens },
    {
      account: { externalId: acc.externalId, name: acc.name, currency: acc.currency, timezone: acc.timezone },
      metrics: req.metrics,
      dimension: req.dimension,
      dateRange: req.range,
      filters: filters.map((f) => ({ dimension: f.dimension, op: f.op, values: f.values })),
    },
  );
  // Samma värde kan förekomma flera gånger (t.ex. sidor); summera inte – behåll per värde.
  return res.map((r) => ({ value: req.dimension ? (r.dims[req.dimension] ?? "") : "", metrics: r.metrics as Record<string, number> }));
}
