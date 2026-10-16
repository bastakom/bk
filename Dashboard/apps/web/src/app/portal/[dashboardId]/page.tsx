import { dashboardPages, formatRange } from "@rp/core";
import { notFound } from "next/navigation";
import { SharedDashboard } from "@/app/s/[token]/shared-dashboard";
import { requirePortal } from "@/lib/dal";
import { loadDashboard } from "@/lib/load-dashboard";
import { workspaceBrand } from "../data";

/** En rapport i kundportalen: samma kundvy som delade länkar (ingen intern data). */
export default async function PortalDashboardPage({ params, searchParams }: PageProps<"/portal/[dashboardId]">) {
  const { dashboardId } = await params;
  const sp = await searchParams;
  const ctx = await requirePortal();
  const data = await ctx.tx(async (tx) => {
    // Bara rapporter som visas i portalen; övriga kunders rapporter stoppas även av databasen.
    if (!(await tx.dashboard.count({ where: { id: dashboardId, inPortal: true } }))) return null;
    return loadDashboard(tx, { dashboardId, searchParams: sp, audience: "client" });
  });
  if (!data) notFound();
  const workspace = await workspaceBrand(ctx.workspace.id);

  return (
    <SharedDashboard
      pdfUrl={`/portal/${dashboardId}/pdf`}
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
      allowDateChange
      allowPdf
    />
  );
}
