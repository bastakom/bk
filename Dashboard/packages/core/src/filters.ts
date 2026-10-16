/**
 * Datafilter (som i Whatagraph): begränsa en widget eller hela dashboarden till t.ex.
 * vissa kampanjer, per kanal eller för alla kanaler.
 *
 * Fakta lagras per dimension (dagstotaler, per kampanj, per ålder …). Ett filter på
 * kampanj räknar därför widgeten från kampanjraderna i stället för dagstotalerna –
 * korrekt eftersom alla lagrade metrics är additiva. Två filterfält för samma kanal
 * (t.ex. kampanj OCH ålder) går inte att kombinera: plattformarna levererar inte den
 * korsningen, så bara det första används och användaren får veta det.
 */
import { z } from "zod";
import { dimensionText, type Lang } from "./i18n";
import { DIMENSIONS } from "./metrics";
import type { DimensionId, PlatformId } from "./types";

export const FILTER_OPS = [
  { id: "in", label: "är någon av" },
  { id: "not_in", label: "är inte någon av" },
  { id: "contains", label: "innehåller" },
  { id: "not_contains", label: "innehåller inte" },
] as const;
export type FilterOp = (typeof FILTER_OPS)[number]["id"];

/** Dimensioner som går att filtrera på (datum styrs av perioden; annonser filtreras via kampanj). */
/** Sammansatta dimensioner filtreras via sina delar (t.ex. kampanj), inte som helhet. */
export const FILTERABLE_DIMENSIONS = (Object.keys(DIMENSIONS) as DimensionId[]).filter(
  (d) => !["date", "source", "ad", "campaign_conversion", "campaign_ad_set", "campaign_device", "campaign_region", "page_channel"].includes(d),
);

const LEGACY_OP: Record<string, FilterOp> = { equals: "in", not_equals: "not_in", contains: "contains", not_contains: "not_contains" };

/** Äldre widgetfilter: { dimension, op: "equals" | …, value } – gällde alla kanaler. */
function fromLegacy(v: unknown): unknown {
  if (!v || typeof v !== "object" || !("value" in v) || "values" in v) return v;
  const old = v as { dimension?: string; op?: string; value?: unknown };
  return { dimension: old.dimension, op: LEGACY_OP[old.op ?? ""] ?? "contains", values: [old.value] };
}

export const dataFilterSchema = z.preprocess(
  fromLegacy,
  z.object({
    /** Tom = alla kanaler. */
    platform: (z.string() as unknown as z.ZodType<PlatformId>).optional(),
    dimension: z.string() as unknown as z.ZodType<DimensionId>,
    op: z.enum(FILTER_OPS.map((o) => o.id) as [FilterOp, ...FilterOp[]]),
    values: z.array(z.string().trim().min(1)).min(1),
  }),
);
export type DataFilter = z.infer<typeof dataFilterSchema>;

/** Sammansatta dimensioner: värdet är delarna med DIMENSION_SEPARATOR emellan, t.ex. "Höst · Köp". */
export const DIMENSION_SEPARATOR = " · ";
export const COMPOSITE_DIMENSIONS: Partial<Record<DimensionId, [DimensionId, DimensionId]>> = {
  campaign_conversion: ["campaign", "conversion"],
  campaign_ad_set: ["campaign", "ad_set"],
  campaign_device: ["campaign", "device"],
  campaign_region: ["campaign", "region"],
  page_channel: ["page_path", "channel_group"],
};

/** Ett sammansatt värde av delarna, t.ex. ["Höst", "Mobil"] → "Höst · Mobil". */
export const joinDimension = (parts: string[]) => parts.join(DIMENSION_SEPARATOR);
/** Delarna i ett sammansatt värde (första delen slutar vid första avgränsaren). */
export function splitDimension(value: string): [string, string] {
  const i = value.indexOf(DIMENSION_SEPARATOR);
  return i < 0 ? [value, ""] : [value.slice(0, i), value.slice(i + DIMENSION_SEPARATOR.length)];
}

/** Om ett filter på `filterDim` kan användas på rader med dimensionen `rowDim`. */
export const filterApplies = (filterDim: DimensionId, rowDim: DimensionId | "" | undefined) =>
  filterDim === rowDim || (!!rowDim && !!COMPOSITE_DIMENSIONS[rowDim]?.includes(filterDim));

/** Den del av ett radvärde som ett filter gäller (hela värdet, eller t.ex. kampanjen i "Höst · Köp"). */
export function dimensionPart(value: string, rowDim: DimensionId | "" | undefined, filterDim: DimensionId): string {
  const parts = rowDim ? COMPOSITE_DIMENSIONS[rowDim] : undefined;
  if (!parts || filterDim === rowDim) return value;
  // Första delen (kampanjen) slutar vid första avgränsaren; andra delen är resten.
  const i = value.indexOf(DIMENSION_SEPARATOR);
  if (i < 0) return parts[0] === filterDim ? value : "";
  return parts[0] === filterDim ? value.slice(0, i) : value.slice(i + DIMENSION_SEPARATOR.length);
}

export function matchesDataFilter(value: string, f: DataFilter, rowDim?: DimensionId | ""): boolean {
  const v = dimensionPart(value, rowDim, f.dimension).toLowerCase();
  const qs = f.values.map((q) => q.toLowerCase());
  switch (f.op) {
    case "in":
      return qs.includes(v);
    case "not_in":
      return !qs.includes(v);
    case "contains":
      return qs.some((q) => v.includes(q));
    case "not_contains":
      return !qs.some((q) => v.includes(q));
  }
}

export interface FilterPlan {
  /** Dimension att läsa fakta från ("" = dagstotaler). */
  fetchDimension: DimensionId | "";
  /** Filter som tillämpas på raderna. */
  apply: DataFilter[];
  /** Slå ihop raderna till totaler (filtret var på en annan dimension än widgetens uppdelning). */
  collapse: boolean;
  /** Filter som inte kan användas för kontot i den här widgeten. */
  skipped: { filter: DataFilter; reason: "other_dimension" | "unsupported" }[];
}

/**
 * Vilka fakta ett konto ska läsas från och vilka filter som gäller.
 * @param breakdown widgetens uppdelning (undefined = totaler)
 * @param supports om plattformen har dimensionen
 */
export function planFilters(platform: PlatformId, breakdown: DimensionId | undefined, filters: DataFilter[], supports: (d: DimensionId) => boolean): FilterPlan {
  const skipped: FilterPlan["skipped"] = [];
  const relevant = filters.filter((f) => {
    if (f.platform && f.platform !== platform) return false;
    if (!supports(f.dimension)) {
      skipped.push({ filter: f, reason: "unsupported" });
      return false;
    }
    return true;
  });
  const dimension = breakdown ?? relevant[0]?.dimension;
  const apply = relevant.filter((f) => filterApplies(f.dimension, dimension));
  for (const f of relevant) if (!filterApplies(f.dimension, dimension)) skipped.push({ filter: f, reason: "other_dimension" });
  if (breakdown) return { fetchDimension: breakdown, apply, collapse: false, skipped };
  return { fetchDimension: dimension ?? "", apply, collapse: apply.length > 0, skipped };
}

/** Kort beskrivning, t.ex. "Meta Ads · Kampanj innehåller Höst". */
const OP_EN: Record<FilterOp, string> = { in: "is any of", not_in: "is not any of", contains: "contains", not_contains: "does not contain" };

export function describeFilter(f: DataFilter, platformLabel?: (p: PlatformId) => string, lang: Lang = "sv"): string {
  const op = lang === "en" ? OP_EN[f.op] : FILTER_OPS.find((o) => o.id === f.op)!.label;
  const values = f.values.length > 3 ? `${f.values.slice(0, 3).join(", ")} +${f.values.length - 3}` : f.values.join(", ");
  const dim = dimensionText(f.dimension, DIMENSIONS[f.dimension]?.label ?? f.dimension, lang);
  return `${f.platform ? `${platformLabel?.(f.platform) ?? f.platform} · ` : ""}${dim} ${op} ${values}`;
}
