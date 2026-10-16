"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { allowAttempt, grantShareAccess, resolveShare, verifyPassword } from "@/lib/share";

export async function unlockShare(token: string, lang: "sv" | "en", _prev: unknown, form: FormData): Promise<{ error: string } | null> {
  const link = await resolveShare(token);
  if (!link?.passwordHash) redirect(`/s/${token}`);
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal";
  const key = `${link.id}:${ip}`;
  if (!allowAttempt(key)) return { error: lang === "en" ? "Too many attempts. Wait 15 minutes and try again." : "För många försök. Vänta en kvart och försök igen." };
  const ok = await verifyPassword(String(form.get("password") ?? ""), link.passwordHash);
  if (!ok) {
    allowAttempt(key, true);
    // Liten fördröjning gör automatiserad gissning ännu långsammare.
    await new Promise((r) => setTimeout(r, 400));
    return { error: lang === "en" ? "Wrong password." : "Fel lösenord." };
  }
  await grantShareAccess(link, token);
  redirect(`/s/${token}`);
}
