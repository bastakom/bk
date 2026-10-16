/**
 * Metric-register: gemensamt gränssnitt för inbyggda metrics och byråns egna
 * formler. Query-motorn och UI:t frågar registret i stället för METRICS direkt.
 */
import { evaluateFormula, formulaRefs, parseFormula, type FormulaNode } from "./formula";
import { computeMetric, METRICS, requiredBaseMetrics, type MetricSums } from "./metrics";
import type { MetricAggregation, MetricFormat, MetricId, PlatformId } from "./types";

/** Det UI:t behöver veta om en metric (serialiserbart). */
export interface MetricMeta {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
  format: MetricFormat;
  aggregation: MetricAggregation | "custom";
  higherIsBetter: boolean | null;
}

export interface CustomMetricDef {
  /** "custom_<nyckel>" */
  id: string;
  label: string;
  formula: string;
  format: MetricFormat;
  higherIsBetter: boolean | null;
  description?: string;
}

export const CUSTOM_PREFIX = "custom_";
export const isCustomId = (id: string) => id.startsWith(CUSTOM_PREFIX);

/** Nyckel för en källbegränsad summa, t.ex. "sessions@ga4". */
export const scopedKey = (metric: string, platform: string) => `${metric}@${platform}`;

/** Plockar ut en källas summor ur en summa med källbegränsade nycklar. */
export function scopeSums(sums: MetricSums, platform: PlatformId): MetricSums {
  const out: MetricSums = {};
  const suffix = `@${platform}`;
  for (const [k, v] of Object.entries(sums)) if (k.endsWith(suffix)) out[k.slice(0, -suffix.length)] = v;
  return out;
}

export class MetricRegistry {
  private customs = new Map<string, { def: CustomMetricDef; tree: FormulaNode }>();

  constructor(customs: CustomMetricDef[] = []) {
    for (const def of customs) {
      try {
        this.customs.set(def.id, { def, tree: parseFormula(def.formula) });
      } catch {
        // Ogiltiga formler ignoreras här; de valideras när de sparas.
      }
    }
  }

  has(id: string) {
    return id in METRICS || this.customs.has(id);
  }

  meta(id: string): MetricMeta {
    const builtin = METRICS[id as MetricId];
    if (builtin) return { ...builtin, id };
    const c = this.customs.get(id);
    if (c) return { id, label: c.def.label, description: c.def.description ?? c.def.formula, format: c.def.format, aggregation: "custom", higherIsBetter: c.def.higherIsBetter };
    return { id, label: id, format: "number", aggregation: "sum", higherIsBetter: null };
  }

  /** Räknar ut en metric från summor (som kan innehålla källbegränsade nycklar). */
  compute(id: string, sums: MetricSums): number | null {
    const c = this.customs.get(id);
    if (!c) return id in METRICS ? computeMetric(id as MetricId, sums) : null;
    return evaluateFormula(c.tree, (metric, platform) => computeMetric(metric, platform ? scopeSums(sums, platform) : sums));
  }

  /** Additiva metrics som måste hämtas för att räkna ut `id`. */
  baseMetrics(id: string): MetricId[] {
    const c = this.customs.get(id);
    if (!c) return id in METRICS ? requiredBaseMetrics(id as MetricId) : [];
    return [...new Set(formulaRefs(c.tree).flatMap((r) => requiredBaseMetrics(r.metric)))];
  }

  /** Referenser i en egen formel (för tillgänglighet per källa). */
  refs(id: string) {
    const c = this.customs.get(id);
    return c ? formulaRefs(c.tree) : [{ metric: id as MetricId }];
  }

  customList(): CustomMetricDef[] {
    return [...this.customs.values()].map((c) => c.def);
  }
}

export const builtinRegistry = new MetricRegistry();
