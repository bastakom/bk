"use server";

import { dataFilterSchema, layoutSchema, WIDGET_META, widgetConfigSchema, type PlatformId, type WidgetType } from "@rp/core";
import type { Prisma, TenantTx } from "@rp/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import type { DashboardSettings } from "@/lib/dashboard-data";
import { requireRole } from "@/lib/dal";
import { snapshotWidgets } from "./widget-snapshot";

const revalidate = () => revalidatePath("/clients/[clientSlug]/dashboards/[dashboardId]", "page");
const ids = z.array(z.string().min(1)).min(1, "Markera minst en widget").max(200);
const needsData = (type: string) => WIDGET_META[type as WidgetType]?.needsData ?? false;

/** Kundens valda källor (id → plattform). Källor utanför kunden avvisas. */
async function clientSources(tx: TenantTx, clientId: string) {
  const rows = await tx.clientSource.findMany({ where: { clientId }, select: { accountId: true, account: { select: { platform: true } } } });
  return new Map(rows.map((r) => [r.accountId, r.account.platform as PlatformId]));
}

async function loadDashboard(tx: TenantTx, dashboardId: string) {
  return tx.dashboard.findFirstOrThrow({ where: { id: dashboardId }, include: { widgets: { include: { sources: true } } } });
}

/** Sätter widgetens källor och kommer ihåg kanalerna (config.sourcePlatforms). */
async function setWidgetSources(tx: TenantTx, widget: { id: string; workspaceId: string; config: unknown }, accountIds: string[], platformOf: Map<string, PlatformId>) {
  const config = widgetConfigSchema.parse(widget.config ?? {});
  const platforms = [...new Set(accountIds.map((id) => platformOf.get(id)!))];
  await tx.widgetSource.deleteMany({ where: { widgetId: widget.id } });
  await tx.widget.update({
    where: { id: widget.id },
    data: {
      config: { ...config, sourcePlatforms: platforms.length ? platforms : config.sourcePlatforms } as Prisma.InputJsonValue,
      sources: { create: accountIds.map((accountId) => ({ workspaceId: widget.workspaceId, accountId })) },
    },
  });
}

// ─── Markera flera widgets ──────────────────────────────────────────────────

/** Ersätter källorna på alla markerade widgets (text och sektioner hoppas över). */
export async function bulkSetSources(dashboardId: string, widgetIds: string[], accountIds: string[]) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const wids = ids.parse(widgetIds);
    const aids = z.array(z.string()).min(1, "Välj minst en källa").max(20).parse(accountIds);
    const n = await ctx.tx(async (tx) => {
      const d = await loadDashboard(tx, dashboardId);
      const platformOf = await clientSources(tx, d.clientId);
      if (aids.some((a) => !platformOf.has(a))) throw new Error("Källan är inte vald för kunden.");
      const targets = d.widgets.filter((w) => wids.includes(w.id) && needsData(w.type));
      for (const w of targets) await setWidgetSources(tx, w, aids, platformOf);
      return targets.length;
    });
    revalidate();
    return { ok: true as const, message: `Källorna är ändrade på ${n} widgets.` };
  });
}

/** Lägger till samma filter på alla markerade widgets. */
export async function bulkAddFilters(dashboardId: string, widgetIds: string[], filters: unknown) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const wids = ids.parse(widgetIds);
    const add = z.array(dataFilterSchema).min(1, "Lägg till minst ett filter").max(10).parse(filters);
    const n = await ctx.tx(async (tx) => {
      const d = await loadDashboard(tx, dashboardId);
      const targets = d.widgets.filter((w) => wids.includes(w.id) && needsData(w.type));
      for (const w of targets) {
        const config = widgetConfigSchema.parse(w.config ?? {});
        await tx.widget.update({ where: { id: w.id }, data: { config: { ...config, filters: [...config.filters, ...add] } as Prisma.InputJsonValue } });
      }
      return targets.length;
    });
    revalidate();
    return { ok: true as const, message: `Filtret är tillagt på ${n} widgets.` };
  });
}

/** Kopierar de markerade widgetarna och lägger kopiorna under dashboarden, i samma inbördes layout. */
export async function bulkDuplicate(dashboardId: string, widgetIds: string[]) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const wids = ids.parse(widgetIds);
    const n = await ctx.tx(async (tx) => {
      const d = await loadDashboard(tx, dashboardId);
      const layoutOf = (l: unknown) => layoutSchema.parse(l);
      const bottom = Math.max(0, ...d.widgets.map((w) => layoutOf(w.layout).y + layoutOf(w.layout).h));
      const targets = d.widgets.filter((w) => wids.includes(w.id));
      const top = Math.min(...targets.map((w) => layoutOf(w.layout).y));
      for (const w of targets) {
        const l = layoutOf(w.layout);
        await tx.widget.create({
          data: {
            workspaceId: w.workspaceId,
            clientId: w.clientId,
            dashboardId: w.dashboardId,
            type: w.type,
            title: w.title ? `${w.title} (kopia)` : null,
            config: w.config as Prisma.InputJsonValue,
            layout: { ...l, y: bottom + (l.y - top) },
            sources: { create: w.sources.map((s) => ({ workspaceId: s.workspaceId, accountId: s.accountId })) },
          },
        });
      }
      return targets.length;
    });
    revalidate();
    return { ok: true as const, message: `${n} widgets är duplicerade (lagda längst ned).` };
  });
}

export async function bulkDelete(dashboardId: string, widgetIds: string[]) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const wids = ids.parse(widgetIds);
    const { res, snap } = await ctx.tx(async (tx) => {
      const snap = (await snapshotWidgets(tx, wids)).filter((s) => s.dashboardId === dashboardId);
      return { snap, res: await tx.widget.deleteMany({ where: { dashboardId, id: { in: wids } } }) };
    });
    revalidate();
    return { ok: true as const, data: snap, message: `${res.count} widgets är borttagna.` };
  });
}

// ─── Rapportens källor ──────────────────────────────────────────────────────

/** Byter en källa mot en annan i alla widgets på dashboarden (och i rapportens standardkällor). */
export async function swapReportSource(dashboardId: string, fromAccountId: string, toAccountId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const n = await ctx.tx(async (tx) => {
      const d = await loadDashboard(tx, dashboardId);
      const platformOf = await clientSources(tx, d.clientId);
      if (!platformOf.has(toAccountId)) throw new Error("Källan är inte vald för kunden.");
      const affected = d.widgets.filter((w) => w.sources.some((s) => s.accountId === fromAccountId));
      for (const w of affected) {
        const next = [...new Set(w.sources.map((s) => (s.accountId === fromAccountId ? toAccountId : s.accountId)))];
        await setWidgetSources(tx, w, next, platformOf);
      }
      const settings = (d.settings ?? {}) as DashboardSettings;
      if (settings.sources?.includes(fromAccountId)) {
        const sources = [...new Set(settings.sources.map((s) => (s === fromAccountId ? toAccountId : s)))];
        await tx.dashboard.update({ where: { id: d.id }, data: { settings: { ...settings, sources } as Prisma.InputJsonValue } });
      }
      return affected.length;
    });
    revalidate();
    return { ok: true as const, message: `Källan är bytt i ${n} widgets.` };
  });
}

/** Ger widgets som saknar källa för en kanal (t.ex. efter borttagen koppling) den valda källan. */
export async function assignMissingSource(dashboardId: string, platform: string, accountId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const n = await ctx.tx(async (tx) => {
      const d = await loadDashboard(tx, dashboardId);
      const platformOf = await clientSources(tx, d.clientId);
      if (platformOf.get(accountId) !== platform) throw new Error("Källan hör inte till kanalen.");
      const missing = d.widgets.filter((w) => {
        if (!needsData(w.type)) return false;
        const config = widgetConfigSchema.parse(w.config ?? {});
        return config.sourcePlatforms.includes(platform as PlatformId) && !w.sources.some((s) => platformOf.get(s.accountId) === platform);
      });
      for (const w of missing) await setWidgetSources(tx, w, [...w.sources.map((s) => s.accountId), accountId], platformOf);
      return missing.length;
    });
    revalidate();
    return { ok: true as const, message: `${n} widgets har fått källan.` };
  });
}

/** Rapportens standardkällor (används automatiskt av nya widgets). */
export async function setReportSources(dashboardId: string, accountIds: string[]) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const aids = z.array(z.string()).max(30).parse(accountIds);
    await ctx.tx(async (tx) => {
      const d = await tx.dashboard.findFirstOrThrow({ where: { id: dashboardId } });
      const platformOf = await clientSources(tx, d.clientId);
      const sources = aids.filter((a) => platformOf.has(a));
      await tx.dashboard.update({ where: { id: d.id }, data: { settings: { ...((d.settings ?? {}) as object), sources } as Prisma.InputJsonValue } });
    });
    revalidate();
    return { ok: true as const, message: "Rapportens källor är sparade." };
  });
}
