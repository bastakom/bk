import { OUTBOX_DIR } from "@rp/reports";
import { readFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/dal";

/** Visar ett mejl eller en PDF ur den lokala utkorgen (endast utveckling/utan Resend). */
export async function GET(_req: Request, { params }: RouteContext<"/api/deliveries/[deliveryId]/[kind]">) {
  const { deliveryId, kind } = await params;
  const ctx = await requireWorkspace();
  const d = await ctx.tx((tx) => tx.reportDelivery.findFirst({ where: { id: deliveryId }, select: { pdfPath: true, htmlPath: true } }));
  const path = kind === "pdf" ? d?.pdfPath : kind === "html" ? d?.htmlPath : null;
  if (!path) return NextResponse.json({ error: "Filen finns inte" }, { status: 404 });
  // Skydd mot sökvägar utanför utkorgen.
  const full = resolve(path);
  if (!full.startsWith(resolve(OUTBOX_DIR) + sep)) return NextResponse.json({ error: "Otillåten sökväg" }, { status: 403 });
  try {
    const body = await readFile(full);
    return new NextResponse(new Uint8Array(body), {
      headers:
        kind === "pdf"
          ? { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${basename(full)}"` }
          : { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:" },
    });
  } catch {
    return NextResponse.json({ error: "Filen har tagits bort" }, { status: 410 });
  }
}
