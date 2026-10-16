import { dashboardPages, widgetPageId, formatRange } from "@rp/core";
import { verifyPrintToken } from "@rp/core/server";
import { db, withTenant } from "@rp/db";
import { notFound } from "next/navigation";
import { loadDashboard } from "@/lib/load-dashboard";
import { flattenPages } from "@/lib/pages";
import { emphasizedIds } from "@/lib/emphasis";
import { PrintDocument } from "./print-document";

export const metadata = { title: "Utskrift", robots: { index: false } };

/**
 * Utskriftsvy som renderas av Playwright till PDF. Ingen inloggning –
 * åtkomst ges av en kortlivad signerad token för exakt den här dashboarden.
 */
export default async function PrintPage({ params, searchParams }: PageProps<"/print/[dashboardId]">) {
  const { dashboardId } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const claims = verifyPrintToken(token, process.env.BETTER_AUTH_SECRET!);
  if (!claims || claims.d !== dashboardId) notFound();

  const data = await withTenant(claims.w, (tx) => loadDashboard(tx, { dashboardId, searchParams: sp }));
  if (!data) notFound();
  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: claims.w }, select: { name: true, logoUrl: true, brandColor: true, fontFamily: true } });

  const part = sp.part === "cover" ? "cover" : "content";
  const layout = sp.layout === "long" ? "long" : "paged";
  let toc: { title: string; page: number }[] = [];
  if (typeof sp.toc === "string") {
    try {
      toc = JSON.parse(Buffer.from(sp.toc, "base64url").toString());
    } catch {
      toc = [];
    }
  }

  return (
    <PrintDocument
      part={part}
      layout={layout}
      toc={toc}
      workspace={workspace}
      client={data.client}
      dashboard={{ id: data.dashboard.id, name: data.dashboard.name }}
      period={formatRange(data.range.range, data.lang)}
      comparePeriod={data.range.compareRange ? formatRange(data.range.compareRange, data.lang) : null}
      lang={data.lang}
      widgets={flattenPages(data.widgets, dashboardPages(data.dashboard.settings))}
      emphasized={dashboardPages(data.dashboard.settings).flatMap((p) => [...emphasizedIds(data.widgets.filter((w) => widgetPageId(w.config, dashboardPages(data.dashboard.settings)) === p.id))])}
      accounts={data.accounts}
      generatedAt={new Date().toISOString()}
      markers={sp.markers === "1"}
    />
  );
}
