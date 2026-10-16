"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { requireRole } from "@/lib/dal";

const input = z.object({
  clientId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ange ett datum"),
  text: z.string().trim().min(1, "Skriv vad som hände").max(200),
  internal: z.boolean().default(false),
});

/** Händelse på ett datum för kunden (visas i alla kundens trendgrafer). */
export async function addAnnotation(raw: z.input<typeof input>) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const a = input.parse(raw);
    await ctx.tx((tx) => tx.annotation.create({ data: { workspaceId: ctx.workspace.id, clientId: a.clientId, date: new Date(a.date), text: a.text, internal: a.internal, createdById: ctx.user.id } }));
    revalidatePath("/clients/[clientSlug]/dashboards/[dashboardId]", "page");
    return { ok: true as const, message: "Händelsen är tillagd." };
  });
}

export async function deleteAnnotation(id: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.annotation.delete({ where: { id } }));
    revalidatePath("/clients/[clientSlug]/dashboards/[dashboardId]", "page");
    return { ok: true as const, message: "Händelsen är borttagen." };
  });
}
