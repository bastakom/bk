import "server-only";
import { friendlyError } from "@rp/core";
import type { WorkspaceContext } from "@/lib/dal";

export interface NavClient {
  id: string;
  name: string;
  slug: string;
  color: string;
}
export interface NavDashboard {
  id: string;
  name: string;
  clientSlug: string;
  clientName: string;
}
export interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
}
export interface Notice {
  id: string;
  tone: "warning" | "danger";
  title: string;
  text: string;
  href: string;
  at: string;
}

/** Det toppfältet behöver: kunder och dashboards för väljarna och ⌘K, samt notiser. */
export async function loadShellData(ctx: WorkspaceContext) {
  return ctx.tx(async (tx) => {
    const [clients, dashboards, alerts, failed, connections, schedules, shares, deliveries] = await Promise.all([
      tx.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true, slug: true, primaryColor: true }, orderBy: { name: "asc" } }),
      tx.dashboard.findMany({ select: { id: true, name: true, client: { select: { slug: true, name: true } } }, orderBy: { updatedAt: "desc" }, take: 500 }),
      tx.syncAlert.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, kind: true, message: true, createdAt: true, account: { select: { name: true } } } }),
      tx.reportDelivery.findMany({
        where: { status: "FAILED", createdAt: { gt: new Date(Date.now() - 14 * 86_400_000) } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, error: true, createdAt: true, subject: true },
      }),
      tx.connection.count(),
      tx.reportSchedule.count({ where: { active: true } }),
      tx.shareLink.count({ where: { revokedAt: null } }),
      tx.reportDelivery.count(),
    ]);
    const notices: Notice[] = [
      ...alerts.map((a) => ({
        id: a.id,
        tone: (a.kind === "AUTH_REQUIRED" ? "warning" : "danger") as Notice["tone"],
        title: `${a.account.name}: ${a.kind === "AUTH_REQUIRED" ? "behörighet saknas" : "synkfel"}`,
        text: friendlyError(a.message)?.text ?? "",
        href: "/settings/sync",
        at: a.createdAt.toISOString(),
      })),
      ...failed.map((d) => ({
        id: d.id,
        tone: "danger" as const,
        title: `Utskick misslyckades: ${d.subject}`,
        text: friendlyError(d.error)?.text ?? "",
        href: "/reports",
        at: d.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return {
      clients: clients.map((c) => ({ id: c.id, name: c.name, slug: c.slug, color: c.primaryColor })) satisfies NavClient[],
      dashboards: dashboards.map((d) => ({ id: d.id, name: d.name, clientSlug: d.client.slug, clientName: d.client.name })) satisfies NavDashboard[],
      notices,
      counts: { clients: clients.length, dashboards: dashboards.length, schedules },
      /** Kom igång: koppla källa → skapa dashboard → dela eller schemalägg en rapport. */
      onboarding: [
        { id: "source", label: "Koppla en källa", done: connections > 0, href: "/databases?koppla=1" },
        { id: "dashboard", label: "Skapa en dashboard", done: dashboards.length > 0, href: clients[0] ? `/clients/${clients[0].slug}?ny=dashboard` : "/clients?ny=1" },
        { id: "share", label: "Dela eller schemalägg en rapport", done: shares + schedules + deliveries > 0, href: "/dashboards" },
      ] satisfies OnboardingStep[],
    };
  });
}
