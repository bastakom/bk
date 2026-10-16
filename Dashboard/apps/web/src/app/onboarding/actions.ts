"use server";

import { db } from "@rp/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { ACTIVE_WORKSPACE_COOKIE, requireUser } from "@/lib/dal";
import { slugify } from "@/lib/format";

const schema = z.object({ name: z.string().trim().min(2, "Ange byråns namn") });

export async function createWorkspace(_: unknown, form: FormData) {
  const result = await runAction(async () => {
    const user = await requireUser();
    const { name } = schema.parse({ name: form.get("name") });
    const base = slugify(name);
    const taken = await db.workspace.count({ where: { slug: { startsWith: base } } });
    const ws = await db.workspace.create({
      data: { name, slug: taken ? `${base}-${taken + 1}` : base, memberships: { create: { userId: user.id, role: "ADMIN" } } },
    });
    (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, ws.id, { httpOnly: true, sameSite: "lax", path: "/" });
  });
  if (result.ok) redirect("/clients");
  return result;
}
