"use server";

import { db, type Role } from "@rp/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { requireRole } from "@/lib/dal";
import { createInvitation } from "@/lib/invitations";

const roleSchema = z.enum(["ADMIN", "EDITOR", "VIEWER", "CLIENT"]);

async function assertAdminRemains(workspaceId: string, changingMembershipId: string, newRole: Role | null) {
  if (newRole === "ADMIN") return;
  const admins = await db.membership.findMany({ where: { workspaceId, role: "ADMIN" }, select: { id: true } });
  if (admins.length === 1 && admins[0]!.id === changingMembershipId) throw new z.ZodError([{ code: "custom", path: [], message: "Byrån måste ha minst en admin", input: null }]);
}

export async function changeRole(membershipId: string, role: string) {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    const newRole = roleSchema.parse(role);
    await assertAdminRemains(ctx.workspace.id, membershipId, newRole);
    await db.membership.update({ where: { id: membershipId, workspaceId: ctx.workspace.id }, data: { role: newRole, ...(newRole === "ADMIN" ? { clientIds: [] } : {}) } });
    revalidatePath("/settings");
    return { ok: true as const, message: "Rollen är uppdaterad." };
  });
}

export async function removeMember(membershipId: string) {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    await assertAdminRemains(ctx.workspace.id, membershipId, null);
    await db.membership.delete({ where: { id: membershipId, workspaceId: ctx.workspace.id } });
    revalidatePath("/settings");
    return { ok: true as const, message: "Personen är borttagen från byrån." };
  });
}

/** Kunder som finns i byrån (övriga id:n ignoreras). */
async function validClientIds(ctx: Awaited<ReturnType<typeof requireRole>>, ids: string[]) {
  if (!ids.length) return [];
  const rows = await ctx.tx((tx) => tx.client.findMany({ where: { id: { in: ids } }, select: { id: true } }));
  return rows.map((r) => r.id);
}

const clientIdsSchema = z.array(z.string().min(1)).max(500);

/** Vilka kunder en person får se. Tom lista = alla (för kundinloggningar: inga). */
export async function setMemberClients(membershipId: string, raw: string[]) {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    const clientIds = await validClientIds(ctx, clientIdsSchema.parse(raw));
    const m = await db.membership.findFirstOrThrow({ where: { id: membershipId, workspaceId: ctx.workspace.id } });
    if (m.role === "ADMIN") return { ok: false as const, error: "Admin ser alltid alla kunder." };
    await db.membership.update({ where: { id: m.id }, data: { clientIds } });
    revalidatePath("/settings");
    return { ok: true as const, message: clientIds.length ? `Tillgång till ${clientIds.length} ${clientIds.length === 1 ? "kund" : "kunder"}.` : m.role === "CLIENT" ? "Inga kunder valda." : "Tillgång till alla kunder." };
  });
}

const inviteSchema = z
  .object({
    email: z.email("Ogiltig e-postadress").transform((e) => e.toLowerCase().trim()),
    name: z.string().trim().max(100).optional(),
    role: roleSchema,
    clientIds: clientIdsSchema.default([]),
  })
  .refine((v) => v.role !== "CLIENT" || v.clientIds.length > 0, { message: "Välj minst en kund för kundinloggningen", path: ["clientIds"] });

/** Bjuder in via mejl (även personer som saknar konto). */
export async function inviteMember(raw: z.input<typeof inviteSchema>) {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    const v = inviteSchema.parse(raw);
    const clientIds = v.role === "ADMIN" ? [] : await validClientIds(ctx, v.clientIds);
    const existing = await db.membership.findFirst({ where: { workspaceId: ctx.workspace.id, user: { email: v.email } } });
    if (existing) return { ok: false as const, error: "Personen är redan medlem. Ändra roll och kunder i listan." };
    await createInvitation({ workspaceId: ctx.workspace.id, email: v.email, name: v.name, role: v.role, clientIds, createdById: ctx.user.id });
    revalidatePath("/settings");
    return { ok: true as const, message: `Inbjudan skickad till ${v.email}.` };
  });
}

export async function revokeInvitation(id: string) {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    await db.invitation.deleteMany({ where: { id, workspaceId: ctx.workspace.id, acceptedAt: null } });
    revalidatePath("/settings");
    return { ok: true as const, message: "Inbjudan är återkallad." };
  });
}
