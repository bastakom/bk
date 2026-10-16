"use server";

import { dashboardPages, dataFilterSchema, FILTERABLE_DIMENSIONS, GRID_COLS, layoutSchema, widgetPageId, videoEmbed, WIDGET_META, WIDGET_TYPES, widgetConfigSchema, type WidgetType } from "@rp/core";
import { dashboardToDefinition, type Prisma } from "@rp/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { snapshotSchema, snapshotWidgets } from "./widget-snapshot";
import { buildDataContext, dashboardFilters, loadWidgetData, resolveDashboardRange, type DashboardSettings, type WidgetData } from "@/lib/dashboard-data";
import { requireRole, requireWorkspace } from "@/lib/dal";
import { syncAndAlert } from "@/lib/sync";

const widgetInput = z.object({
  dashboardId: z.string().min(1),
  widgetId: z.string().optional(),
  type: z.enum(WIDGET_TYPES),
  title: z.string().trim().max(120).nullable(),
  config: widgetConfigSchema,
  accountIds: z.array(z.string()).max(20),
});
export type WidgetInput = z.input<typeof widgetInput>;

const revalidate = () => revalidatePath("/clients/[clientSlug]/dashboards/[dashboardId]", "page");

export async function saveWidget(input: WidgetInput) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const w = widgetInput.parse(input);
    // Bild/video: bara egna uppladdade bilder och YouTube/Vimeo.
    if (w.type === "media") {
      const url = w.config.mediaUrl ?? "";
      const okImage = w.config.mediaKind !== "video" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(url);
      const okVideo = w.config.mediaKind === "video" && !!videoEmbed(url);
      if (!okImage && !okVideo) throw new Error("Välj en bild eller en YouTube-/Vimeo-länk.");
    }
    await ctx.tx(async (tx) => {
      const dashboard = await tx.dashboard.findFirstOrThrow({ where: { id: w.dashboardId }, include: { widgets: { select: { layout: true, config: true } } } });
      // Kom ihåg kanalerna, så att widgeten vet vilken källa den behöver om kontot försvinner.
      const platforms = await tx.connectedAccount.findMany({ where: { id: { in: w.accountIds } }, select: { platform: true } });
      const sourcePlatforms = platforms.length ? [...new Set(platforms.map((p) => p.platform))] : w.config.sourcePlatforms;
      const data = { type: w.type, title: w.title || null, config: { ...w.config, sourcePlatforms } as Prisma.InputJsonValue };
      // WidgetSource har sammansatt nyckel (accountId, clientId): ett konto från en annan kund avvisas av databasen.
      const sources = { create: w.accountIds.map((accountId) => ({ workspaceId: ctx.workspace.id, accountId })) };
      if (w.widgetId) {
        await tx.widgetSource.deleteMany({ where: { widgetId: w.widgetId } });
        await tx.widget.update({ where: { id: w.widgetId, dashboardId: dashboard.id }, data: { ...data, sources } });
      } else {
        // Ny widget hamnar längst ned på sin sida.
        const pages = dashboardPages((dashboard.settings ?? {}) as DashboardSettings);
        const page = widgetPageId(w.config, pages);
        const bottom = dashboard.widgets.reduce((max, x) => {
          const l = layoutSchema.safeParse(x.layout);
          const samePage = widgetPageId(widgetConfigSchema.parse(x.config ?? {}), pages) === page;
          return l.success && samePage ? Math.max(max, l.data.y + l.data.h) : max;
        }, 0);
        const size = WIDGET_META[w.type as WidgetType].defaultSize;
        await tx.widget.create({
          data: { ...data, workspaceId: ctx.workspace.id, clientId: dashboard.clientId, dashboardId: dashboard.id, layout: { x: 0, y: bottom, ...size }, sources },
        });
      }
      await tx.dashboard.update({ where: { id: dashboard.id }, data: { updatedAt: new Date() } });
    });
    revalidate();
  });
}

// ─── Ta bort med ångra ─────────────────────────────────────────────────────────
// Borttagning returnerar en ögonblicksbild som "Ångra" återskapar med samma id.

export async function deleteWidget(widgetId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const snap = await ctx.tx(async (tx) => {
      const s = await snapshotWidgets(tx, [widgetId]);
      await tx.widget.delete({ where: { id: widgetId } });
      return s;
    });
    revalidate();
    return { ok: true as const, data: snap, message: "Widgeten är borttagen." };
  });
}

/** Återskapar borttagna widgets (Ångra). Källorna måste fortfarande höra till kunden. */
export async function restoreWidgets(raw: unknown) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const snaps = z.array(snapshotSchema).min(1).max(200).parse(raw);
    await ctx.tx(async (tx) => {
      for (const s of snaps) {
        const d = await tx.dashboard.findUniqueOrThrow({ where: { id: s.dashboardId }, select: { clientId: true, workspaceId: true } });
        const valid = await tx.clientSource.findMany({ where: { clientId: d.clientId, accountId: { in: s.accountIds } }, select: { accountId: true } });
        await tx.widget.create({
          data: {
            id: s.id,
            workspaceId: d.workspaceId,
            clientId: d.clientId,
            dashboardId: s.dashboardId,
            type: s.type,
            title: s.title,
            config: widgetConfigSchema.parse(s.config ?? {}) as Prisma.InputJsonValue,
            layout: s.layout,
            sources: { create: valid.map((v) => ({ workspaceId: d.workspaceId, accountId: v.accountId })) },
          },
        });
      }
    });
    revalidate();
    return { ok: true as const, message: snaps.length === 1 ? "Widgeten är tillbaka." : `${snaps.length} widgets är tillbaka.` };
  });
}

export async function duplicateWidget(widgetId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    await ctx.tx(async (tx) => {
      const w = await tx.widget.findUniqueOrThrow({ where: { id: widgetId }, include: { sources: true } });
      const l = layoutSchema.parse(w.layout);
      await tx.widget.create({
        data: {
          workspaceId: w.workspaceId,
          clientId: w.clientId,
          dashboardId: w.dashboardId,
          type: w.type,
          title: w.title ? `${w.title} (kopia)` : null,
          config: w.config as Prisma.InputJsonValue,
          layout: { ...l, y: l.y + l.h },
          sources: { create: w.sources.map((s) => ({ workspaceId: s.workspaceId, accountId: s.accountId })) },
        },
      });
    });
    revalidate();
  });
}

const layoutInput = z.array(layoutSchema.extend({ id: z.string() })).max(200);

export async function saveLayout(dashboardId: string, items: z.input<typeof layoutInput>) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const parsed = layoutInput.parse(items);
    await ctx.tx(async (tx) => {
      for (const { id, x, y, w, h } of parsed) {
        await tx.widget.update({ where: { id, dashboardId }, data: { layout: { x: Math.min(x, GRID_COLS - 1), y, w: Math.min(w, GRID_COLS), h } } });
      }
    });
  });
}

/** Förhandsvisning i widget-editorn: samma dataladdning som dashboarden. */
export async function previewWidget(input: WidgetInput, searchParams: Record<string, string>): Promise<WidgetData | null> {
  const ctx = await requireWorkspace();
  const w = widgetInput.safeParse(input);
  if (!w.success) return null;
  return ctx.tx(async (tx) => {
    const dashboard = await tx.dashboard.findFirstOrThrow({ where: { id: w.data.dashboardId }, include: { client: true } });
    const settings = (dashboard.settings ?? {}) as DashboardSettings;
    const range = resolveDashboardRange(searchParams, settings, dashboard.client.timezone);
    const ctx = await buildDataContext(tx, {
      clientId: dashboard.clientId,
      clientCurrency: dashboard.client.currency,
      clientTimezone: dashboard.client.timezone,
      range,
      filters: dashboardFilters(settings),
    });
    return loadWidgetData(tx, { type: w.data.type, config: w.data.config, accountIds: w.data.accountIds }, ctx);
  });
}

export async function updateDashboard(dashboardId: string, patch: { name?: string; settings?: DashboardSettings }) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const name = patch.name !== undefined ? z.string().trim().min(1, "Ange ett namn").max(80).parse(patch.name) : undefined;
    await ctx.tx(async (tx) => {
      // Inställningarna slås ihop: att spara standardperioden ska inte ta bort dashboardens filter.
      const current = patch.settings ? (((await tx.dashboard.findUniqueOrThrow({ where: { id: dashboardId } })).settings ?? {}) as DashboardSettings) : undefined;
      await tx.dashboard.update({
        where: { id: dashboardId },
        data: { name, settings: patch.settings ? ({ ...current, ...patch.settings } as Prisma.InputJsonValue) : undefined },
      });
    });
    revalidate();
    return { ok: true as const, message: patch.settings ? "Standardperioden är sparad." : "Sparat." };
  });
}

/** Filter för hela dashboarden (gäller även delade länkar, PDF och utskick). */
export async function saveDashboardFilters(dashboardId: string, filters: unknown) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const parsed = z.array(dataFilterSchema).max(20).parse(filters);
    await ctx.tx(async (tx) => {
      const d = await tx.dashboard.findUniqueOrThrow({ where: { id: dashboardId } });
      await tx.dashboard.update({ where: { id: dashboardId }, data: { settings: { ...((d.settings ?? {}) as object), filters: parsed } as Prisma.InputJsonValue } });
    });
    revalidate();
    return { ok: true as const, message: parsed.length ? "Filtren är sparade." : "Filtren är borttagna." };
  });
}

/**
 * Värden att välja bland i filtret, t.ex. kundens kampanjer i en kanal.
 * Senast aktiva först (sorterat på senaste dag med data).
 */
export async function loadFilterValues(dashboardId: string, platform: string | null, dimension: string): Promise<string[]> {
  const ctx = await requireWorkspace();
  if (!(FILTERABLE_DIMENSIONS as string[]).includes(dimension)) return [];
  return ctx.tx(async (tx) => {
    const d = await tx.dashboard.findFirstOrThrow({ where: { id: dashboardId }, select: { clientId: true } });
    const accounts = await tx.connectedAccount.findMany({ where: { clientSources: { some: { clientId: d.clientId } }, ...(platform ? { platform } : {}) }, select: { id: true } });
    if (!accounts.length) return [];
    const rows = await tx.metricFact.groupBy({
      by: ["dimensionValue"],
      where: { accountId: { in: accounts.map((a) => a.id) }, dimension },
      _max: { date: true },
      orderBy: { _max: { date: "desc" } },
      take: 500,
    });
    return rows.map((r) => r.dimensionValue).filter(Boolean);
  });
}

export async function deleteDashboard(dashboardId: string) {
  const res = await runAction(async () => {
    const ctx = await requireRole("EDITOR");
    return ctx.tx(async (tx) => {
      const d = await tx.dashboard.delete({ where: { id: dashboardId }, include: { client: { select: { slug: true } } } });
      return d.client.slug;
    });
  });
  if (res.ok && res.data) redirect(`/clients/${res.data}`);
  return res;
}

/** Duplicerar inom samma kund – samma konton följer med. */
export async function duplicateDashboard(dashboardId: string) {
  const res = await runAction(async () => {
    const ctx = await requireRole("EDITOR");
    return ctx.tx(async (tx) => {
      const d = await tx.dashboard.findUniqueOrThrow({ where: { id: dashboardId }, include: { client: true, widgets: { include: { sources: true } } } });
      const copy = await tx.dashboard.create({
        data: { workspaceId: d.workspaceId, clientId: d.clientId, name: `${d.name} (kopia)`, description: d.description, settings: d.settings as Prisma.InputJsonValue },
      });
      for (const w of d.widgets) {
        await tx.widget.create({
          data: {
            workspaceId: w.workspaceId,
            clientId: w.clientId,
            dashboardId: copy.id,
            type: w.type,
            title: w.title,
            config: w.config as Prisma.InputJsonValue,
            layout: w.layout as Prisma.InputJsonValue,
            sources: { create: w.sources.map((s) => ({ workspaceId: s.workspaceId, accountId: s.accountId })) },
          },
        });
      }
      return `/clients/${d.client.slug}/dashboards/${copy.id}`;
    });
  });
  if (res.ok && res.data) redirect(res.data);
  return res;
}

const templateInput = z.object({ name: z.string().trim().min(1, "Ange ett namn").max(80), description: z.string().trim().max(300).optional() });

export async function saveAsTemplate(dashboardId: string, input: z.input<typeof templateInput>) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const { name, description } = templateInput.parse(input);
    await ctx.tx(async (tx) => {
      const definition = await dashboardToDefinition(tx, dashboardId);
      await tx.dashboardTemplate.create({ data: { workspaceId: ctx.workspace.id, name, description, definition: definition as unknown as Prisma.InputJsonValue } });
    });
    revalidatePath("/templates");
    return { ok: true as const, message: `Mallen "${name}" är sparad.` };
  });
}

/** Synkar alla konton som dashboarden använder (senaste 30 dagarna). */
export async function refreshDashboard(dashboardId: string) {
  return runAction(async () => {
    const ctx = await requireRole("EDITOR");
    const accountIds = await ctx.tx(async (tx) => {
      const sources = await tx.widgetSource.findMany({ where: { widget: { dashboardId } }, select: { accountId: true }, distinct: ["accountId"] });
      return sources.map((s) => s.accountId);
    });
    let failed = 0;
    for (const id of accountIds) {
      const res = await syncAndAlert(ctx.tx, id, { days: 30 });
      if (!res.ok) failed++;
    }
    revalidate();
    return failed
      ? { ok: false as const, error: `${failed} av ${accountIds.length} källor kunde inte synkas. Se kundens kontolista.` }
      : { ok: true as const, message: `${accountIds.length} källor uppdaterade.` };
  });
}
