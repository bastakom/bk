"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { requireRole } from "@/lib/dal";

const schema = z.object({ clientId: z.string().min(1), name: z.string().trim().min(1, "Ange ett namn").max(80) });

export async function createDashboard(_: unknown, form: FormData) {
  const result = await runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const { clientId, name } = schema.parse(Object.fromEntries(form));
    return ctx.tx(async (tx) => {
      const client = await tx.client.findFirstOrThrow({ where: { id: clientId }, select: { slug: true } });
      const d = await tx.dashboard.create({ data: { workspaceId: ctx.workspace.id, clientId, name }, select: { id: true } });
      return { slug: client.slug, id: d.id };
    });
  });
  if (result.ok && result.data) redirect(`/clients/${result.data.slug}/dashboards/${result.data.id}`);
  return result;
}
