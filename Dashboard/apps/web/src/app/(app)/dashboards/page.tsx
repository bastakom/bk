import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/dal";
import { DashboardsList } from "./dashboards-list";

export const metadata = { title: "Dashboards" };

/** Alla rapporter över alla kunder, med sök, kundfilter och sortering. */
export default async function DashboardsPage() {
  const ctx = await requireWorkspace();
  const rows = await ctx.tx((tx) =>
    tx.dashboard.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        inPortal: true,
        client: { select: { id: true, name: true, slug: true, primaryColor: true, logoUrl: true } },
        _count: { select: { widgets: true, shareLinks: { where: { revokedAt: null } }, schedules: { where: { active: true } } } },
      },
    }),
  );
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
      <PageHeader title="Dashboards" description="Alla kunders rapporter på ett ställe." />
      <DashboardsList
        rows={rows.map((d) => ({
          id: d.id,
          name: d.name,
          updatedAt: d.updatedAt.toISOString(),
          inPortal: d.inPortal,
          widgets: d._count.widgets,
          shared: d._count.shareLinks,
          scheduled: d._count.schedules,
          client: d.client,
        }))}
      />
    </div>
  );
}
