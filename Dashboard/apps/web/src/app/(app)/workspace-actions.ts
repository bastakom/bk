"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_WORKSPACE_COOKIE, requireWorkspace } from "@/lib/dal";

export async function switchWorkspace(workspaceId: string) {
  const ctx = await requireWorkspace();
  if (!ctx.workspaces.some((w) => w.id === workspaceId)) return;
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/clients");
}
