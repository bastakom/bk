import { describeFormula, METRICS, parseFormula, PLATFORMS } from "@rp/core";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/dal";
import { SettingsNav } from "../settings-nav";
import { CustomMetricsManager } from "./custom-metrics-manager";

export const metadata = { title: "Egna metrics" };

export default async function CustomMetricsPage() {
  const ctx = await requireWorkspace();
  const metrics = await ctx.tx((tx) => tx.customMetric.findMany({ orderBy: { name: "asc" } }));
  const readable = (f: string) => {
    try {
      return describeFormula(parseFormula(f));
    } catch {
      return "Ogiltig formel";
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <PageHeader title="Inställningar" description={ctx.workspace.name} />
      <SettingsNav />
      <CustomMetricsManager
        canEdit={ctx.can("EDITOR")}
        metrics={metrics.map((m) => ({
          id: m.id,
          key: m.key,
          name: m.name,
          formula: m.formula,
          readable: readable(m.formula),
          format: m.format,
          higherIsBetter: m.higherIsBetter,
          description: m.description,
        }))}
        reference={{
          metrics: Object.values(METRICS).map((m) => ({ id: m.id, label: m.label, derived: m.aggregation === "derived" })),
          platforms: Object.values(PLATFORMS).map((p) => ({ id: p.id, label: p.label })),
        }}
      />
    </div>
  );
}
