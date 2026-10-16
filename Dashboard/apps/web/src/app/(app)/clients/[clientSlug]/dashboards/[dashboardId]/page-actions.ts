"use server";

import { dashboardPages, layoutSchema, widgetConfigSchema, widgetPageId, type DashboardPage } from "@rp/core";
import type { Prisma, TenantTx } from "@rp/db";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import type { DashboardSettings } from "@/lib/dashboard-data";
import { requireRole } from "@/lib/dal";

const revalidate = () => revalidatePath("/clients/[clientSlug]/dashboards/[dashboardId]", "page");
const pageName = z.string().trim().min(1, "Ange ett namn").max(40);

async function withPages<T>(tx: TenantTx, dashboardId: string, fn: (pages: DashboardPage[], settings: DashboardSettings) => Promise<{ pages: DashboardPage[]; result: T }>) {
  const d = await tx.dashboard.findFirstOrThrow({ where: { id: dashboardId } });
  const settings = (d.settings ?? {}) as DashboardSettings;
  const { pages, result } = await fn(dashboardPages(settings), settings);
  await tx.dashboard.update({ where: { id: d.id }, data: { settings: { ...settings, pages } as unknown as Prisma.InputJsonValue } });
  return result;
}

export async function addPage(dashboardId: string, name: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const n = pageName.parse(name);
    const id = await ctx.tx((tx) =>
      withPages(tx, dashboardId, async (pages) => {
        const id = randomBytes(6).toString("base64url");
        return { pages: [...pages, { id, name: n }], result: id };
      }),
    );
    revalidate();
    return { ok: true as const, data: id, message: `Sidan "${n}" är skapad.` };
  });
}

export async function renamePage(dashboardId: string, pageId: string, name: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const n = pageName.parse(name);
    await ctx.tx((tx) => withPages(tx, dashboardId, async (pages) => ({ pages: pages.map((p) => (p.id === pageId ? { ...p, name: n } : p)), result: null })));
    revalidate();
    return { ok: true as const, message: "Sidan har bytt namn." };
  });
}

export async function movePage(dashboardId: string, pageId: string, direction: -1 | 1) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx((tx) =>
      withPages(tx, dashboardId, async (pages) => {
        const i = pages.findIndex((p) => p.id === pageId);
        const j = i + direction;
        if (i < 0 || j < 0 || j >= pages.length) return { pages, result: null };
        const next = [...pages];
        [next[i], next[j]] = [next[j]!, next[i]!];
        return { pages: next, result: null };
      }),
    );
    revalidate();
    return { ok: true as const };
  });
}

/** Tar bort sidan och dess widgets. Den sista sidan kan inte tas bort. */
export async function deletePage(dashboardId: string, pageId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const removed = await ctx.tx(async (tx) => {
      const widgets = await tx.widget.findMany({ where: { dashboardId }, select: { id: true, config: true } });
      return withPages(tx, dashboardId, async (pages) => {
        if (pages.length <= 1) throw new Error("En dashboard måste ha minst en sida.");
        const onPage = widgets.filter((w) => widgetPageId(widgetConfigSchema.parse(w.config ?? {}), pages) === pageId).map((w) => w.id);
        await tx.widget.deleteMany({ where: { id: { in: onPage } } });
        return { pages: pages.filter((p) => p.id !== pageId), result: onPage.length };
      });
    });
    revalidate();
    return { ok: true as const, message: removed ? `Sidan och dess ${removed} widgets är borttagna.` : "Sidan är borttagen." };
  });
}

/** Flyttar widgets till en annan sida och lägger dem längst ned där, i samma inbördes ordning. */
export async function moveWidgetsToPage(dashboardId: string, widgetIds: string[], pageId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const ids = z.array(z.string()).min(1).max(200).parse(widgetIds);
    const n = await ctx.tx(async (tx) => {
      const d = await tx.dashboard.findFirstOrThrow({ where: { id: dashboardId }, include: { widgets: true } });
      const pages = dashboardPages((d.settings ?? {}) as DashboardSettings);
      if (!pages.some((p) => p.id === pageId)) throw new Error("Sidan finns inte.");
      const parsed = d.widgets.map((w) => ({ w, config: widgetConfigSchema.parse(w.config ?? {}), layout: layoutSchema.parse(w.layout) }));
      const bottom = Math.max(0, ...parsed.filter((x) => widgetPageId(x.config, pages) === pageId && !ids.includes(x.w.id)).map((x) => x.layout.y + x.layout.h));
      const moving = parsed.filter((x) => ids.includes(x.w.id));
      const top = Math.min(...moving.map((x) => x.layout.y));
      for (const x of moving) {
        await tx.widget.update({
          where: { id: x.w.id },
          data: { config: { ...x.config, pageId } as Prisma.InputJsonValue, layout: { ...x.layout, y: bottom + (x.layout.y - top) } },
        });
      }
      return moving.length;
    });
    revalidate();
    return { ok: true as const, message: `${n} widgets är flyttade.` };
  });
}
