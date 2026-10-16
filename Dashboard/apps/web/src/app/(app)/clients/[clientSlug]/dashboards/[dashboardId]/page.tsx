import { db } from "@rp/db";
import { notFound } from "next/navigation";
import { shareBaseUrl, workspaceWhiteLabel } from "@/lib/white-label";
import { requireWorkspace } from "@/lib/dal";
import { DashboardShell } from "./dashboard-shell";
import { loadDashboard } from "@/lib/load-dashboard";

export async function generateMetadata({ params }: PageProps<"/clients/[clientSlug]/dashboards/[dashboardId]">) {
  const { dashboardId } = await params;
  const ctx = await requireWorkspace();
  const d = await ctx.tx((tx) => tx.dashboard.findFirst({ where: { id: dashboardId }, select: { name: true, client: { select: { name: true } } } }));
  return { title: d ? `${d.name} · ${d.client.name}` : "Dashboard" };
}

export default async function DashboardPage({ params, searchParams }: PageProps<"/clients/[clientSlug]/dashboards/[dashboardId]">) {
  const { clientSlug, dashboardId } = await params;
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const data = await ctx.tx((tx) => loadDashboard(tx, { clientSlug, dashboardId, searchParams: sp, audience: "internal" }));
  if (!data) notFound();

  const schedules = ctx.can("EDITOR")
    ? await ctx.tx((tx) =>
        tx.reportSchedule.findMany({
          where: { dashboardId },
          orderBy: { createdAt: "asc" },
          include: { deliveries: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
        }),
      )
    : [];

  const shareLinks = ctx.can("EDITOR")
    ? await ctx.tx((tx) => tx.shareLink.findMany({ where: { dashboardId, revokedAt: null }, orderBy: { createdAt: "desc" } }))
    : [];

  const clients = ctx.can("EDITOR")
    ? await ctx.tx((tx) => tx.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } }))
    : [];

  // Kundinloggningar som ser den här kunden i portalen.
  const portalUsers = ctx.can("EDITOR") ? await db.membership.count({ where: { workspaceId: ctx.workspace.id, role: "CLIENT", clientIds: { has: data.client.id } } }) : 0;

  const shareBase = shareBaseUrl(await workspaceWhiteLabel(ctx.workspace.id));
  return (
    <DashboardShell
      {...data}
      canEdit={ctx.can("EDITOR")}
      portalUsers={portalUsers}
      otherClients={clients.filter((c) => c.id !== data.client.id)}
      shareLinks={shareLinks
        .filter((l) => !l.expiresAt || l.expiresAt > new Date())
        .map((l) => ({
          id: l.id,
          url: `${shareBase}/s/${l.token}`,
          label: l.label,
          hasPassword: !!l.passwordHash,
          expiresAt: l.expiresAt?.toISOString() ?? null,
          allowDateChange: l.allowDateChange,
          allowPdf: l.allowPdf,
          viewCount: l.viewCount,
          lastViewedAt: l.lastViewedAt?.toISOString() ?? null,
        }))}
      schedules={schedules.map((s) => ({
        id: s.id,
        frequency: s.frequency,
        weekday: s.weekday,
        dayOfMonth: s.dayOfMonth,
        hour: s.hour,
        timezone: s.timezone,
        recipients: s.recipients,
        rangePreset: s.rangePreset,
        active: s.active,
        nextRunAt: s.nextRunAt.toISOString(),
        lastStatus: s.deliveries[0]?.status ?? null,
      }))}
    />
  );
}
