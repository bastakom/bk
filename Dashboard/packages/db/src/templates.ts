/**
 * Mallar och kopiering av dashboards. En mall lagrar inga konto-id:n, bara
 * "källplatser" (slots) per plattform. Vid applicering mappar användaren varje
 * slot mot ett av kundens konton.
 */
import { PLATFORMS, type PlatformId, type WidgetConfig, type WidgetLayout, type WidgetType } from "@rp/core";
import type { Prisma } from "./generated/prisma/client";
import type { TenantTx } from "./index";

export interface TemplateSlot {
  key: string;
  platform: PlatformId;
  label: string;
}

export interface TemplateDefinition {
  version: 1;
  slots: TemplateSlot[];
  settings: Record<string, unknown>;
  widgets: { type: WidgetType; title: string | null; config: WidgetConfig; layout: WidgetLayout; slots: string[] }[];
}

/** Gör om en dashboard till en kontooberoende definition. */
export async function dashboardToDefinition(tx: TenantTx, dashboardId: string): Promise<TemplateDefinition> {
  const dashboard = await tx.dashboard.findUniqueOrThrow({
    where: { id: dashboardId },
    include: { widgets: { include: { sources: { include: { source: { include: { account: { select: { id: true, platform: true } } } } } } } } },
  });
  const slotByAccount = new Map<string, TemplateSlot>();
  const perPlatform = new Map<string, number>();
  for (const w of dashboard.widgets) {
    for (const s of w.sources) {
      if (slotByAccount.has(s.accountId)) continue;
      const platform = s.source.account.platform as PlatformId;
      const n = (perPlatform.get(platform) ?? 0) + 1;
      perPlatform.set(platform, n);
      slotByAccount.set(s.accountId, { key: `${platform}_${n}`, platform, label: PLATFORMS[platform].label });
    }
  }
  // Numrera bara när en plattform förekommer flera gånger ("Google Ads 1", "Google Ads 2").
  for (const slot of slotByAccount.values()) {
    if ((perPlatform.get(slot.platform) ?? 0) > 1) slot.label = `${slot.label} ${slot.key.split("_").pop()}`;
  }
  return {
    version: 1,
    slots: [...slotByAccount.values()],
    settings: (dashboard.settings as Record<string, unknown>) ?? {},
    widgets: dashboard.widgets.map((w) => ({
      type: w.type as WidgetType,
      title: w.title,
      config: w.config as WidgetConfig,
      layout: w.layout as WidgetLayout,
      slots: w.sources.map((s) => slotByAccount.get(s.accountId)!.key),
    })),
  };
}

/**
 * Skapar en dashboard hos kunden från en definition. `mapping` är slot → konto-id
 * (eller null för att hoppa över källan). Källorna måste vara valda av kunden; det
 * garanteras av databasens nyckel mot client_sources (clientId, accountId).
 */
export async function createDashboardFromDefinition(
  tx: TenantTx,
  params: { workspaceId: string; clientId: string; name: string; definition: TemplateDefinition; mapping: Record<string, string | null> },
) {
  const { workspaceId, clientId, definition, mapping } = params;
  const dashboard = await tx.dashboard.create({
    data: { workspaceId, clientId, name: params.name, settings: definition.settings as Prisma.InputJsonValue },
  });
  for (const w of definition.widgets) {
    const accountIds = [...new Set(w.slots.map((s) => mapping[s]).filter((x): x is string => !!x))];
    await tx.widget.create({
      data: {
        workspaceId,
        clientId,
        dashboardId: dashboard.id,
        type: w.type,
        title: w.title,
        config: w.config as Prisma.InputJsonValue,
        layout: w.layout as Prisma.InputJsonValue,
        sources: { create: accountIds.map((accountId) => ({ workspaceId, accountId })) },
      },
    });
  }
  return dashboard;
}
