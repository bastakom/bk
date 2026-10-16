"use server";

import { nextRun, RANGE_PRESETS } from "@rp/core";
import { deliverReport } from "@rp/reports";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { appUrl } from "@/lib/app-url";
import { requireRole } from "@/lib/dal";

const recipients = z
  .string()
  .transform((s) => [...new Set(s.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))])
  .pipe(z.array(z.email("Ogiltig e-postadress")).min(1, "Ange minst en mottagare").max(20, "Högst 20 mottagare"));

const presets = RANGE_PRESETS.map((p) => p.id) as [string, ...string[]];

const scheduleInput = z
  .object({
    dashboardId: z.string().min(1),
    frequency: z.enum(["WEEKLY", "MONTHLY"]),
    weekday: z.coerce.number().int().min(1).max(7).optional(),
    dayOfMonth: z.coerce.number().int().min(0).max(28).optional(),
    hour: z.coerce.number().int().min(0).max(23),
    rangePreset: z.enum(presets),
    compare: z.enum(["previous_period", "previous_year", "none"]),
    layout: z.enum(["PAGED", "LONG"]),
    recipients,
    subject: z.string().trim().min(1, "Ange ämnesrad").max(150),
    message: z.string().trim().max(2000).optional(),
  })
  .refine((v) => (v.frequency === "WEEKLY" ? v.weekday !== undefined : v.dayOfMonth !== undefined), "Välj dag");

export type ScheduleInput = z.input<typeof scheduleInput>;

const revalidate = () => {
  revalidatePath("/clients/[clientSlug]/dashboards/[dashboardId]", "page");
  revalidatePath("/reports");
};

export async function createSchedule(raw: ScheduleInput) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const v = scheduleInput.parse(raw);
    await ctx.tx(async (tx) => {
      const d = await tx.dashboard.findUniqueOrThrow({ where: { id: v.dashboardId }, select: { clientId: true, client: { select: { timezone: true } } } });
      const rule = { frequency: v.frequency, weekday: v.weekday, dayOfMonth: v.dayOfMonth, hour: v.hour, timezone: d.client.timezone };
      await tx.reportSchedule.create({
        data: {
          ...rule,
          weekday: v.frequency === "WEEKLY" ? v.weekday : null,
          dayOfMonth: v.frequency === "MONTHLY" ? v.dayOfMonth : null,
          workspaceId: ctx.workspace.id,
          clientId: d.clientId,
          dashboardId: v.dashboardId,
          rangePreset: v.rangePreset,
          compare: v.compare,
          layout: v.layout,
          recipients: v.recipients,
          subject: v.subject,
          message: v.message || null,
          nextRunAt: nextRun(rule, new Date()),
          createdById: ctx.user.id,
        },
      });
    });
    revalidate();
    return { ok: true as const, message: "Utskicket är schemalagt." };
  });
}

export async function setScheduleActive(id: string, active: boolean) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx(async (tx) => {
      const s = await tx.reportSchedule.findUniqueOrThrow({ where: { id } });
      // Vid återaktivering räknas nästa körning från nu, så att missade utskick inte skickas i klump.
      await tx.reportSchedule.update({ where: { id }, data: { active, nextRunAt: active ? nextRun(s, new Date()) : s.nextRunAt } });
    });
    revalidate();
    return { ok: true as const, message: active ? "Utskicket är aktiverat." : "Utskicket är pausat." };
  });
}

export async function deleteSchedule(id: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) => tx.reportSchedule.delete({ where: { id } }));
    revalidate();
    return { ok: true as const, message: "Utskicket är borttaget." };
  });
}

/** Skicka direkt (t.ex. för att testa ett schema) – samma rendering och mejl som det schemalagda. */
export async function sendNow(raw: ScheduleInput) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const v = scheduleInput.parse(raw);
    const delivery = await deliverReport({
      db: ctx.tx,
      baseUrl: appUrl(),
      secret: process.env.BETTER_AUTH_SECRET!,
      workspaceId: ctx.workspace.id,
      dashboardId: v.dashboardId,
      recipients: v.recipients,
      subject: v.subject,
      message: v.message,
      rangePreset: v.rangePreset,
      compare: v.compare,
      layout: v.layout === "LONG" ? "long" : "paged",
    });
    revalidate();
    return {
      ok: true as const,
      message: delivery.provider === "outbox" ? `Lagt i utkorgen (${delivery.pageCount} sidor) – se Utskick.` : `Skickat till ${v.recipients.join(", ")}.`,
    };
  });
}
