import "server-only";
import { dataFilterSchema, matchesDataFilter, planFilters, type DataFilter, type PlatformId } from "@rp/core";
import type { TenantTx } from "@rp/db";
import type { Catalog } from "./availability";

export interface ClientSourceRef {
  accountId: string;
  platform: PlatformId;
  filters: DataFilter[];
}

/**
 * Dagstotaler per källa, avgränsade med kundens filter för källan. Med ett
 * kampanjfilter räknas totalen från kampanjraderna (alla lagrade metrics är additiva).
 */
export async function loadClientSourceTotals(tx: TenantTx, sources: ClientSourceRef[], catalog: Catalog, start: string, end: string) {
  const plans = new Map(sources.map((s) => [s.accountId, planFilters(s.platform, undefined, s.filters, (d) => !!catalog[s.platform]?.dimensions.includes(d))]));
  const groups = new Map<string, string[]>();
  for (const s of sources) {
    const d = plans.get(s.accountId)!.fetchDimension;
    groups.set(d, [...(groups.get(d) ?? []), s.accountId]);
  }
  if (!groups.size) return [];
  const rows = await tx.metricFact.findMany({
    where: { OR: [...groups].map(([d, ids]) => ({ accountId: { in: ids }, dimension: d })), date: { gte: new Date(start), lte: new Date(end) } },
    select: { accountId: true, date: true, dimensionValue: true, metrics: true },
  });
  return rows.filter((r) => plans.get(r.accountId)!.apply.every((f) => matchesDataFilter(r.dimensionValue, f)));
}

/** Kundens filter för en källa, tåligt mot gamla eller trasiga värden. */
export function parseSourceFilters(raw: unknown): DataFilter[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((f) => {
    const r = dataFilterSchema.safeParse(f);
    return r.success ? [r.data] : [];
  });
}
