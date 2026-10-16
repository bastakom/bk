"use server";

import { db } from "@rp/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { BRAND_FONTS } from "@/lib/brand";
import { requireRole } from "@/lib/dal";
import { logoSchema } from "@/lib/logo";
import { checkDomain, checkSender, DOMAIN_RE } from "@/lib/white-label";

const input = z.object({
  name: z.string().trim().min(2, "Ange byråns namn").max(80),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ogiltig färg"),
  fontFamily: z.enum(Object.keys(BRAND_FONTS) as [string, ...string[]]),
  logoUrl: logoSchema,
});

export async function saveBrand(raw: z.input<typeof input>) {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    const v = input.parse(raw);
    await db.workspace.update({ where: { id: ctx.workspace.id }, data: v });
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Varumärket är sparat – syns i appen, delade länkar, PDF och mejl." };
  });
}

const normalizeDomain = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

const whiteLabelInput = z.object({
  customDomain: z
    .string()
    .transform(normalizeDomain)
    .refine((d) => d === "" || DOMAIN_RE.test(d), "Ange en domän, t.ex. rapport.bastakompisar.se"),
  emailFromName: z.string().trim().max(60),
  emailFrom: z.union([z.literal(""), z.email("Ange en giltig e-postadress").trim().toLowerCase()]),
});

/** Egen domän för delade länkar och egen avsändare. Ändringar kräver ny verifiering. */
export async function saveWhiteLabel(raw: z.input<typeof whiteLabelInput>) {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    const v = whiteLabelInput.parse(raw);
    const current = await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspace.id } });
    if (v.customDomain) {
      const taken = await db.workspace.findFirst({ where: { customDomain: v.customDomain, id: { not: ctx.workspace.id } }, select: { id: true } });
      if (taken) throw new Error("Domänen används redan av en annan byrå.");
    }
    await db.workspace.update({
      where: { id: ctx.workspace.id },
      data: {
        customDomain: v.customDomain || null,
        domainVerifiedAt: v.customDomain && v.customDomain === current.customDomain ? current.domainVerifiedAt : null,
        emailFromName: v.emailFromName || null,
        emailFrom: v.emailFrom || null,
        emailVerifiedAt: v.emailFrom && v.emailFrom === current.emailFrom ? current.emailVerifiedAt : null,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Sparat. Kontrollera DNS och avsändare för att aktivera." };
  });
}

/** Kontrollerar DNS-posterna; domänen aktiveras när TXT-posten stämmer. */
export async function verifyDomain() {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    const ws = await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspace.id } });
    if (!ws.customDomain) throw new Error("Ange en domän först.");
    const check = await checkDomain(ws.customDomain, ws.id);
    await db.workspace.update({ where: { id: ws.id }, data: { domainVerifiedAt: check.txt ? (ws.domainVerifiedAt ?? new Date()) : null } });
    revalidatePath("/", "layout");
    if (!check.txt) return { ok: false as const, error: "TXT-posten hittades inte (DNS-ändringar kan ta upp till några timmar)." };
    return {
      ok: true as const,
      message: check.cnameOk ? "Domänen är verifierad och aktiv." : `Domänen är verifierad. Obs: CNAME pekar ${check.cname ? `mot ${check.cname}` : "inte"} mot appen än.`,
    };
  });
}

/** Kontrollerar att avsändarens domän är verifierad hos e-posttjänsten. */
export async function verifySender() {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    const ws = await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspace.id } });
    if (!ws.emailFrom) throw new Error("Ange en avsändaradress först.");
    const res = await checkSender(ws.emailFrom);
    await db.workspace.update({ where: { id: ws.id }, data: { emailVerifiedAt: res.ok ? (ws.emailVerifiedAt ?? new Date()) : null } });
    revalidatePath("/", "layout");
    return res.ok ? { ok: true as const, message: "Avsändaren är verifierad – utskick och larm skickas från den." } : { ok: false as const, error: res.reason ?? "Avsändaren kunde inte verifieras." };
  });
}
