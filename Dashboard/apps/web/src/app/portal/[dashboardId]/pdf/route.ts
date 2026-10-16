import { pdfFilename, renderDashboardPdf } from "@rp/reports";
import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-url";
import { resolveDashboardRange, type DashboardSettings } from "@/lib/dashboard-data";
import { requirePortal } from "@/lib/dal";

export const maxDuration = 120;

/** PDF för en rapport i kundportalen. */
export async function GET(req: NextRequest, { params }: RouteContext<"/portal/[dashboardId]/pdf">) {
  const { dashboardId } = await params;
  const ctx = await requirePortal();
  const d = await ctx.tx((tx) =>
    tx.dashboard.findFirst({ where: { id: dashboardId, inPortal: true }, select: { name: true, settings: true, client: { select: { name: true, timezone: true } } } }),
  );
  if (!d) return NextResponse.json({ error: "Ingen åtkomst" }, { status: 404 });
  const range = resolveDashboardRange(Object.fromEntries(req.nextUrl.searchParams), (d.settings ?? {}) as DashboardSettings, d.client.timezone);
  const pdf = await renderDashboardPdf({
    baseUrl: appUrl(),
    secret: process.env.BETTER_AUTH_SECRET!,
    workspaceId: ctx.workspace.id,
    dashboardId,
    layout: req.nextUrl.searchParams.get("layout") === "long" ? "long" : "paged",
    query: { range: range.preset, compare: range.compare, from: range.preset === "custom" ? range.range.start : undefined, to: range.preset === "custom" ? range.range.end : undefined },
  });
  return new NextResponse(new Uint8Array(pdf.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(d.client.name, d.name, range.range)}"`,
      "Cache-Control": "no-store",
    },
  });
}
