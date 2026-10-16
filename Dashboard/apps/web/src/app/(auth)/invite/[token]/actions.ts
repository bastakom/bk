"use server";

import { db } from "@rp/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ACTIVE_WORKSPACE_COOKIE, getSession } from "@/lib/dal";
import { acceptInvitation, findInvitation } from "@/lib/invitations";

const home = (role: string) => (role === "CLIENT" ? "/portal" : "/clients");

async function finish(invId: string, userId: string) {
  const inv = await acceptInvitation(invId, userId);
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, inv.workspaceId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect(home(inv.role));
}

const newUserSchema = z.object({
  name: z.string().trim().min(1, "Fyll i ditt namn").max(100),
  password: z.string().min(10, "Lösenordet måste vara minst 10 tecken").max(200),
});

/** Ny användare: skapar kontot med inbjudans e-post, loggar in och gör personen till medlem. */
export async function acceptAsNewUser(token: string, _: unknown, form: FormData): Promise<{ error: string } | undefined> {
  const inv = await findInvitation(token);
  if (!inv) return { error: "Inbjudan är ogiltig eller har gått ut." };
  const parsed = newUserSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  if (await db.user.findUnique({ where: { email: inv.email } })) return { error: "Det finns redan ett konto för adressen. Logga in i stället." };
  let userId: string;
  try {
    const res = await auth.api.signUpEmail({ body: { email: inv.email, password: parsed.data.password, name: parsed.data.name }, headers: await headers() });
    userId = res.user.id;
  } catch (e) {
    console.error(e);
    return { error: "Kontot kunde inte skapas. Försök igen." };
  }
  await finish(inv.id, userId);
}

/** Inloggad användare med samma e-post som inbjudan. */
export async function acceptAsSignedIn(token: string) {
  const inv = await findInvitation(token);
  const session = await getSession();
  if (!inv || !session || session.user.email.toLowerCase() !== inv.email) redirect(`/invite/${token}`);
  await finish(inv.id, session.user.id);
}
