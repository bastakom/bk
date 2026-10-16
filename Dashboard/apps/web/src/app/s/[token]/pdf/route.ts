import { pdfFilename, renderDashboardPdf } from "@rp/reports";

import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { resolveDashboardRange, type DashboardSettings } from "@/lib/dashboard-data";
import { hasShareAccess, resolveShare } from "@/lib/share";
import { withTenant } from "@rp/db";

export const maxDuration = 120;

/** PDF för en delad dashboard – samma rendering som i appen, med länkens behörighet. */
export async function GET(req: NextRequest, { params }: RouteContext<"/s/[token]/pdf">) {
  const { token } = await params;
  const link = await resolveShare(token);
  if (!link || !link.allowPdf || !(await hasShareAccess(link))) return NextResponse.json({ error: "Ingen åtkomst" }, { status: 404 });
  const d = await withTenant(link.workspaceId, (tx) =>
    tx.dashboard.findUniqueOrThrow({ where: { id: link.dashboardId }, select: { name: true, settings: true, client: { select: { name: true, timezone: true } } } }),
  );
  const sp = link.allowDateChange ? Object.fromEntries(req.nextUrl.searchParams) : {};
  const range = resolveDashboardRange(sp, (d.settings ?? {}) as DashboardSettings, d.client.timezone);
  const pdf = await renderDashboardPdf({
    baseUrl: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET!,
    workspaceId: link.workspaceId,
    dashboardId: link.dashboardId,
    layout: req.nextUrl.searchParams.get("layout") === "long" ? "long" : "paged",
    query: { range: range.preset, compare: range.compare, from: range.preset === "custom" ? range.range.start : undefined, to: range.preset === "custom" ? range.range.end : undefined },
  });

  const filename = pdfFilename(d.client.name, d.name, range.range);
  return new NextResponse(new Uint8Array(pdf.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
