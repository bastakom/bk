"use server";

import { FormulaError, parseFormula } from "@rp/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { requireRole } from "@/lib/dal";
import { slugify } from "@/lib/format";

const input = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Ange ett namn").max(60),
  formula: z.string().trim().min(1, "Ange en formel").max(500),
  format: z.enum(["number", "currency", "percent", "duration"]),
  higherIsBetter: z.enum(["true", "false", "null"]).transform((v) => (v === "null" ? null : v === "true")),
  description: z.string().trim().max(300).optional(),
});

export async function saveCustomMetric(raw: z.input<typeof input>) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const data = input.parse(raw);
    try {
      parseFormula(data.formula);
    } catch (e) {
      return { ok: false as const, error: e instanceof FormulaError ? `Formeln: ${e.message}` : "Ogiltig formel" };
    }
    await ctx.tx(async (tx) => {
      const fields = { name: data.name, formula: data.formula, format: data.format, higherIsBetter: data.higherIsBetter, description: data.description || null };
      if (data.id) {
        // Nyckeln (och därmed metric-id:t i widgets) ändras aldrig vid redigering.
        await tx.customMetric.update({ where: { id: data.id }, data: fields });
      } else {
        const base = slugify(data.name).replace(/-/g, "_");
        const taken = await tx.customMetric.count({ where: { key: { startsWith: base } } });
        await tx.customMetric.create({ data: { ...fields, workspaceId: ctx.workspace.id, key: taken ? `${base}_${taken + 1}` : base } });
      }
    });
    revalidatePath("/settings/metrics");
    return { ok: true as const, message: data.id ? "Metricen är uppdaterad." : `"${data.name}" finns nu i widget-editorn.` };
  });
}

export async function deleteCustomMetric(id: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.customMetric.delete({ where: { id } }));
    revalidatePath("/settings/metrics");
    return { ok: true as const, message: "Metricen är borttagen. Widgets som använde den visar ett meddelande." };
  });
}
