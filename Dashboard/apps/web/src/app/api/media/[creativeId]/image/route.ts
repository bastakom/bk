import { withTenant } from "@rp/db";
import { verifyMedia } from "@/lib/media";

/** Annonsens bild, sparad vid synk. */
export async function GET(req: Request, { params }: RouteContext<"/api/media/[creativeId]/image">) {
  const { creativeId } = await params;
  const workspaceId = verifyMedia(creativeId, "image", new URL(req.url).searchParams);
  if (!workspaceId) return new Response("Ogiltig eller utgången länk", { status: 403 });
  const img = await withTenant(workspaceId, (tx) => tx.creative.findUnique({ where: { id: creativeId }, select: { imageData: true, imageType: true } }));
  if (!img?.imageData || !img.imageType) return new Response("Bild saknas", { status: 404 });
  return new Response(img.imageData, {
    headers: {
      "Content-Type": img.imageType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
