"use server";

import { dataFilterSchema, FILTERABLE_DIMENSIONS, goalInputSchema, type PlatformId } from "@rp/core";
import type { Prisma } from "@rp/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { requireRole } from "@/lib/dal";
import { slugify } from "@/lib/format";
import { briefSchema } from "@/lib/ai/brief";
import { alertRuleSchema, evaluateRule } from "@/lib/alerts";
import { logoSchema } from "@/lib/logo";
import { syncAndAlert, syncNewSources } from "@/lib/sync";

const TIMEZONES = Intl.supportedValuesOf("timeZone");

const clientSchema = z.object({
  name: z.string().trim().min(2, "Ange kundens namn").max(80),
  currency: z.enum(["SEK", "EUR", "USD", "NOK", "DKK", "GBP"], { message: "Välj en giltig valuta" }),
  timezone: z.string().refine((tz) => TIMEZONES.includes(tz), "Ogiltig tidszon"),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ogiltig färg"),
});

export async function createClient(_: unknown, form: FormData) {
  const result = await runAction(async () => {
    const ctx = await requireRole("EDITOR", { allClients: true });
    const data = clientSchema.parse(Object.fromEntries(form));
    return ctx.tx(async (tx) => {
      const base = slugify(data.name);
      const existing = await tx.client.count({ where: { workspaceId: ctx.workspace.id, slug: { startsWith: base } } });
      return tx.client.create({
        data: { ...data, workspaceId: ctx.workspace.id, slug: existing ? `${base}-${existing + 1}` : base },
        select: { slug: true },
      });
    });
  });
  if (result.ok && result.data) redirect(`/clients/${result.data.slug}`);
  return result;
}

const updateSchema = clientSchema.extend({
  id: z.string().min(1),
  locale: z.enum(["sv-SE", "en-GB"]).default("sv-SE"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ogiltig färg"),
  logoUrl: logoSchema,
});

export async function updateClient(raw: z.input<typeof updateSchema>) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const { id, ...data } = updateSchema.parse(raw);
    await ctx.tx((tx) => tx.client.update({ where: { id }, data }));
    revalidatePath("/clients", "layout");
    return { ok: true as const, message: "Kunden är uppdaterad." };
  });
}

export async function syncAccountNow(accountId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    // RLS säkerställer att kontot tillhör byrån; findFirst ger null annars.
    const account = await ctx.tx((tx) => tx.connectedAccount.findFirst({ where: { id: accountId }, select: { id: true } }));
    if (!account) throw new Error("Kontot finns inte");
    const res = await syncAndAlert(ctx.tx, account.id, { days: 30 });
    revalidatePath("/clients", "layout");
    return res.ok
      ? { ok: true as const, message: `Synkat: ${res.rowsWritten.toLocaleString("sv-SE")} rader` }
      : { ok: false as const, error: res.auth ? `Behörighet saknas: ${res.error}` : `Synkfel: ${res.error}` };
  });
}

const sourcesInput = z.object({ clientId: z.string().min(1), accountIds: z.array(z.string().min(1)).min(1, "Välj minst en källa").max(100) });

/**
 * Kunden väljer källor från Databaser. Källor som aldrig synkats hämtar sin
 * historik direkt efter svaret, så att kunden inte behöver vänta.
 */
export async function addClientSources(raw: z.input<typeof sourcesInput>) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR", { allClients: true });
    const { clientId, accountIds } = sourcesInput.parse(raw);
    const added = await ctx.tx(async (tx) => {
      await tx.client.findFirstOrThrow({ where: { id: clientId } });
      // Bara källor från aktiva inloggningar i byrån (RLS begränsar till byrån).
      const valid = await tx.connectedAccount.findMany({ where: { id: { in: accountIds }, connection: { status: "ACTIVE" } }, select: { id: true } });
      const res = await tx.clientSource.createMany({ data: valid.map((a) => ({ workspaceId: ctx.workspace.id, clientId, accountId: a.id })), skipDuplicates: true });
      return { count: res.count, ids: valid.map((a) => a.id) };
    });
    after(() => syncNewSources(ctx.tx, added.ids));
    revalidatePath("/", "layout");
    return { ok: true as const, message: added.count === 1 ? "Källan är tillagd. Data hämtas nu." : `${added.count} källor är tillagda. Data hämtas nu.` };
  });
}

/**
 * Tar bort källan från kunden. Källan och dess data finns kvar i Databaser (och
 * hos andra kunder som använder den); kundens widgets slutar använda den.
 */
export async function removeClientSource(clientId: string, accountId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.clientSource.delete({ where: { clientId_accountId: { clientId, accountId } } }));
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Källan är borttagen från kunden." };
  });
}

/** Kundens filter för en källa, t.ex. bara kampanjer som innehåller "Sommar". */
export async function saveClientSourceFilters(clientId: string, accountId: string, filters: unknown) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const parsed = z.array(dataFilterSchema).max(10).parse(filters);
    await ctx.tx(async (tx) => {
      const source = await tx.clientSource.findUniqueOrThrow({ where: { clientId_accountId: { clientId, accountId } }, include: { account: { select: { platform: true } } } });
      // Filtret gäller alltid källans egen kanal.
      const scoped = parsed.map((f) => ({ ...f, platform: source.account.platform as PlatformId }));
      await tx.clientSource.update({ where: { clientId_accountId: { clientId, accountId } }, data: { filters: scoped as Prisma.InputJsonValue } });
    });
    revalidatePath("/", "layout");
    return { ok: true as const, message: parsed.length ? "Kundens filter för källan är sparat." : "Filtret är borttaget." };
  });
}

/** Värden att välja i kundens källfilter (t.ex. källans kampanjer, senast aktiva först). */
export async function loadSourceFilterValues(accountId: string, dimension: string): Promise<string[]> {
  const ctx = await requireRole("EDITOR");
  if (!(FILTERABLE_DIMENSIONS as string[]).includes(dimension)) return [];
  return ctx.tx(async (tx) => {
    // Begränsade användare når bara källor som någon av deras kunder använder.
    if (ctx.clientIds && !(await tx.clientSource.count({ where: { accountId } }))) return [];
    const rows = await tx.metricFact.groupBy({ by: ["dimensionValue"], where: { accountId, dimension }, _max: { date: true }, orderBy: { _max: { date: "desc" } }, take: 500 });
    return rows.map((r) => r.dimensionValue).filter(Boolean);
  });
}

/** Skapar eller uppdaterar ett av kundens mål (t.ex. leads per månad, CPA, budget). */
export async function saveClientGoal(clientId: string, goalId: string | null, raw: unknown) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const g = goalInputSchema.parse(raw);
    await ctx.tx(async (tx) => {
      // Källor måste vara valda av kunden.
      const chosen = await tx.clientSource.findMany({ where: { clientId, accountId: { in: g.accountIds } }, select: { accountId: true } });
      const data = {
        label: g.label ?? null,
        metric: g.metric,
        target: g.target,
        period: g.period,
        startDate: g.period === "custom" && g.startDate ? new Date(g.startDate) : null,
        endDate: g.period === "custom" && g.endDate ? new Date(g.endDate) : null,
        group: g.group ?? null,
        filters: g.filters as Prisma.InputJsonValue,
        accountIds: chosen.map((c) => c.accountId),
      };
      if (goalId) await tx.clientGoal.update({ where: { id: goalId }, data });
      else await tx.clientGoal.create({ data: { ...data, workspaceId: ctx.workspace.id, clientId, sortOrder: await tx.clientGoal.count({ where: { clientId } }) } });
    });
    revalidatePath("/clients", "layout");
    return { ok: true as const, message: goalId ? "Målet är uppdaterat." : "Målet är tillagt." };
  });
}

export async function deleteClientGoal(goalId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.clientGoal.delete({ where: { id: goalId } }));
    revalidatePath("/clients", "layout");
    return { ok: true as const, message: "Målet är borttaget." };
  });
}

/** Skapar eller uppdaterar en larmregel för kunden. */
export async function saveAlertRule(clientId: string, ruleId: string | null, raw: unknown) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const r = alertRuleSchema.parse(raw);
    await ctx.tx(async (tx) => {
      const data =
        r.kind === "metric"
          ? { kind: r.kind, metric: r.metric, op: r.op, threshold: r.threshold, window: r.window, accountIds: r.accountIds, goalId: null, recipientIds: r.recipientIds, active: r.active }
          : { kind: r.kind, goalId: r.goalId, metric: null, op: null, threshold: null, accountIds: [], recipientIds: r.recipientIds, active: r.active };
      // Ändrad regel kontrolleras på nytt vid nästa körning.
      const reset = { firing: false, lastCheckedAt: null, lastValue: null };
      if (ruleId) await tx.alertRule.update({ where: { id: ruleId }, data: { ...data, ...reset } });
      else await tx.alertRule.create({ data: { ...data, workspaceId: ctx.workspace.id, clientId } });
    });
    revalidatePath("/clients", "layout");
    return { ok: true as const, message: ruleId ? "Larmet är uppdaterat." : "Larmet är skapat." };
  });
}

export async function deleteAlertRule(ruleId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.alertRule.delete({ where: { id: ruleId } }));
    revalidatePath("/clients", "layout");
    return { ok: true as const, message: "Larmet är borttaget." };
  });
}

/** Kontrollerar regeln nu och visar resultatet (inget mejl skickas, inget sparas). */
export async function testAlertRule(ruleId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const e = await ctx.tx(async (tx) => evaluateRule(tx, await tx.alertRule.findUniqueOrThrow({ where: { id: ruleId } })));
    return { ok: true as const, message: `${e.triggered ? "Larmar" : "OK"}: ${e.description}` };
  });
}

/** Kundens interna brief för AI-analysen (mål, budget, målgrupp). */
export async function saveClientBrief(clientId: string, raw: unknown) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const brief = briefSchema.parse(raw);
    await ctx.tx((tx) => tx.client.update({ where: { id: clientId }, data: { brief: brief as Prisma.InputJsonValue } }));
    revalidatePath("/clients", "layout");
    return { ok: true as const, message: "Briefen är sparad." };
  });
}

/** Raderar kunden med dashboards och kundens val av källor. Källorna finns kvar i Databaser. */
export async function deleteClient(clientId: string, confirmName: string) {
  const result = await runAction(async () => {
    const ctx = await requireRole("ADMIN");
    await ctx.tx(async (tx) => {
      const client = await tx.client.findFirstOrThrow({ where: { id: clientId } });
      if (client.name !== confirmName.trim()) throw new z.ZodError([{ code: "custom", path: ["name"], message: "Namnet stämmer inte", input: confirmName }]);
      await tx.client.delete({ where: { id: clientId } });
    });
  });
  if (result.ok) redirect("/clients");
  return result;
}
