import "server-only";
import { layoutSchema, WIDGET_TYPES, type WidgetType } from "@rp/core";
import type { TenantTx } from "@rp/db";
import { z } from "zod";

/** Ögonblicksbild av en widget, så att en borttagning kan ångras. */
export const snapshotSchema = z.object({
  id: z.string().min(1).max(64),
  dashboardId: z.string().min(1),
  type: z.enum(WIDGET_TYPES as unknown as [WidgetType, ...WidgetType[]]),
  title: z.string().max(200).nullable(),
  config: z.unknown(),
  layout: layoutSchema,
  accountIds: z.array(z.string()).max(50),
});
export type WidgetSnapshot = z.infer<typeof snapshotSchema>;

export async function snapshotWidgets(tx: TenantTx, ids: string[]): Promise<WidgetSnapshot[]> {
  const rows = await tx.widget.findMany({ where: { id: { in: ids } }, include: { sources: true } });
  return rows.map((w) => ({ id: w.id, dashboardId: w.dashboardId, type: w.type as WidgetType, title: w.title, config: w.config, layout: layoutSchema.parse(w.layout), accountIds: w.sources.map((s) => s.accountId) }));
}

