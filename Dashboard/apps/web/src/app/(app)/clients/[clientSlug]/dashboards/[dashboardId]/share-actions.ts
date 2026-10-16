"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { shareBaseUrl, workspaceWhiteLabel } from "@/lib/white-label";
import { requireRole } from "@/lib/dal";
import { hashPassword, newShareToken } from "@/lib/share";

const input = z.object({
  dashboardId: z.string().min(1),
  label: z.string().trim().max(80).optional(),
  password: z.string().max(200).optional(),
  expiresInDays: z.coerce.number().int().min(0).max(365).default(0),
  allowDateChange: z.boolean().default(true),
  allowPdf: z.boolean().default(true),
});

const revalidate = () => revalidatePath("/clients/[clientSlug]/dashboards/[dashboardId]", "page");

export async function createShareLink(raw: z.input<typeof input>) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const v = input.parse(raw);
    if (v.password && v.password.length < 8) return { ok: false as const, error: "Lösenordet måste vara minst 8 tecken." };
    const token = newShareToken();
    await ctx.tx(async (tx) => {
      const d = await tx.dashboard.findUniqueOrThrow({ where: { id: v.dashboardId }, select: { clientId: true } });
      await tx.shareLink.create({
        data: {
          workspaceId: ctx.workspace.id,
          clientId: d.clientId,
          dashboardId: v.dashboardId,
          token,
          label: v.label || null,
          passwordHash: v.password ? await hashPassword(v.password) : null,
          expiresAt: v.expiresInDays ? new Date(Date.now() + v.expiresInDays * 86_400_000) : null,
          allowDateChange: v.allowDateChange,
          allowPdf: v.allowPdf,
          createdById: ctx.user.id,
        },
      });
    });
    revalidate();
    return { ok: true as const, data: `${shareBaseUrl(await workspaceWhiteLabel(ctx.workspace.id))}/s/${token}`, message: "Länken är skapad och kopierad." };
  });
}

/** Visa eller dölj dashboarden i kundportalen. */
export async function setInPortal(dashboardId: string, inPortal: boolean) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.dashboard.update({ where: { id: dashboardId }, data: { inPortal: z.boolean().parse(inPortal) } }));
    revalidate();
    return { ok: true as const, message: inPortal ? "Rapporten visas i kundportalen." : "Rapporten är dold i kundportalen." };
  });
}

export async function revokeShareLink(id: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.shareLink.update({ where: { id }, data: { revokedAt: new Date() } }));
    revalidate();
    return { ok: true as const, message: "Länken är avstängd och slutar fungera direkt." };
  });
}
