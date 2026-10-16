import { pdfFilename, renderDashboardPdf } from "@rp/reports";
import { NextResponse, type NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/dal";
import { resolveDashboardRange, type DashboardSettings } from "@/lib/dashboard-data";
import { appUrl } from "@/lib/app-url";

// Playwright behöver Node-runtime; exporten kan ta några sekunder.
export const maxDuration = 120;

/** Exporterar dashboarden som PDF med samma period och jämförelse som i vyn. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/dashboards/[dashboardId]/pdf">) {
  const { dashboardId } = await params;
  const ctx = await requireWorkspace();
  const dashboard = await ctx.tx((tx) =>
    tx.dashboard.findFirst({ where: { id: dashboardId }, select: { name: true, settings: true, client: { select: { name: true, timezone: true } } } }),
  );
  if (!dashboard) return NextResponse.json({ error: "Dashboarden finns inte" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const query = { range: sp.get("range") ?? undefined, compare: sp.get("compare") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined };
  const range = resolveDashboardRange(query, (dashboard.settings ?? {}) as DashboardSettings, dashboard.client.timezone);

  try {
    const pdf = await renderDashboardPdf({
      baseUrl: appUrl(),
      secret: process.env.BETTER_AUTH_SECRET!,
      workspaceId: ctx.workspace.id,
      dashboardId,
      layout: sp.get("layout") === "long" ? "long" : "paged",
      query: { ...query, range: range.preset, from: range.preset === "custom" ? range.range.start : undefined, to: range.preset === "custom" ? range.range.end : undefined, compare: range.compare },
    });
    const filename = pdfFilename(dashboard.client.name, dashboard.name, range.range);
    return new NextResponse(new Uint8Array(pdf.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Page-Count": String(pdf.pages),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("PDF-export misslyckades", e);
    return NextResponse.json({ error: "PDF-exporten misslyckades. Försök igen." }, { status: 500 });
  }
}
