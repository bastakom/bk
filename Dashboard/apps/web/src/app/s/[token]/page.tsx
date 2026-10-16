import { dashboardPages, formatRange, langOf } from "@rp/core";
import { db, withTenant } from "@rp/db";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { customHostWorkspace } from "@/lib/white-label";
import { loadDashboard } from "@/lib/load-dashboard";
import { hasShareAccess, resolveShare } from "@/lib/share";
import { PasswordForm } from "./password-form";
import { SharedDashboard } from "./shared-dashboard";

// Delade rapporter ska aldrig indexeras eller läcka sin adress via Referer.
export const metadata: Metadata = { title: "Rapport", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharePage({ params, searchParams }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const link = await resolveShare(token);
  if (!link) notFound();
  // På en byrås egen domän visas bara den byråns rapporter.
  const owner = await customHostWorkspace((await headers()).get("host"));
  if (owner === "unknown" || (owner && owner.id !== link.workspaceId)) notFound();
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: link.workspaceId }, select: { name: true, logoUrl: true, brandColor: true, fontFamily: true } });
  // Kundens språk (rapporten visas på det språk som valts för kunden).
  const lang = langOf((await withTenant(link.workspaceId, (tx) => tx.dashboard.findUnique({ where: { id: link.dashboardId }, select: { client: { select: { locale: true } } } })))?.client.locale);
  if (!(await hasShareAccess(link))) return <PasswordForm token={token} agency={workspace.name} logoUrl={workspace.logoUrl} lang={lang} />;

  const data = await withTenant(link.workspaceId, async (tx) => {
    const d = await loadDashboard(tx, { dashboardId: link.dashboardId, searchParams: link.allowDateChange ? sp : {} });
    await tx.shareLink.update({ where: { id: link.id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } });
    return d;
  });
  if (!data) notFound();

  return (
    <SharedDashboard
      pdfUrl={`/s/${token}/pdf`}
      workspace={workspace}
      client={data.client}
      dashboard={{ id: data.dashboard.id, name: data.dashboard.name }}
      range={data.range}
      periodLabel={formatRange(data.range.range, data.lang)}
      lang={data.lang}
      widgets={data.widgets}
      pages={dashboardPages(data.dashboard.settings)}
      accounts={data.accounts}
      lastSynced={data.lastSynced}
      allowDateChange={link.allowDateChange}
      allowPdf={link.allowPdf}
    />
  );
}
