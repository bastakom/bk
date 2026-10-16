"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions";
import { requireRole } from "@/lib/dal";

export async function deleteTemplate(id: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.dashboardTemplate.delete({ where: { id } }));
    revalidatePath("/templates");
    return { ok: true as const, message: "Mallen är raderad. Dashboards som skapats från den påverkas inte." };
  });
}
