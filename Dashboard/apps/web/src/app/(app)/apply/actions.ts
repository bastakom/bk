"use server";

import { createDashboardFromDefinition, dashboardToDefinition, type TemplateDefinition } from "@rp/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { requireRole } from "@/lib/dal";

const input = z.object({
  source: z.discriminatedUnion("kind", [z.object({ kind: z.literal("template"), id: z.string() }), z.object({ kind: z.literal("dashboard"), id: z.string() })]),
  clientId: z.string().min(1),
  name: z.string().trim().min(1, "Ange ett namn").max(80),
  mapping: z.record(z.string(), z.string().nullable()),
});

/** Skapar en dashboard hos kunden från en mall eller en annan kunds dashboard. */
export async function applyDefinition(raw: z.input<typeof input>) {
  const res = await runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const { source, clientId, name, mapping } = input.parse(raw);
    return ctx.tx(async (tx) => {
      const definition =
        source.kind === "template"
          ? ((await tx.dashboardTemplate.findFirstOrThrow({ where: { id: source.id } })).definition as unknown as TemplateDefinition)
          : await dashboardToDefinition(tx, source.id);
      const client = await tx.client.findFirstOrThrow({ where: { id: clientId }, select: { slug: true } });
      // Validera att varje mappat konto är valt av kunden och har rätt plattform.
      const accounts = await tx.connectedAccount.findMany({ where: { clientSources: { some: { clientId } } }, select: { id: true, platform: true } });
      for (const slot of definition.slots) {
        const accountId = mapping[slot.key];
        if (!accountId) continue;
        const acc = accounts.find((a) => a.id === accountId);
        if (!acc || acc.platform !== slot.platform) throw new z.ZodError([{ code: "custom", path: [slot.key], message: `Ogiltigt konto för ${slot.label}`, input: accountId }]);
      }
      const d = await createDashboardFromDefinition(tx, { workspaceId: ctx.workspace.id, clientId, name, definition, mapping });
      return `/clients/${client.slug}/dashboards/${d.id}`;
    });
  });
  if (res.ok && res.data) redirect(res.data);
  return res;
}
