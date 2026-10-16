import type { TokenSet } from "@rp/core";
import { decryptSecret, getConnector } from "@rp/core/server";
import { withTenant } from "@rp/db";
import { NextResponse } from "next/server";
import { verifyMedia } from "@/lib/media";

/**
 * Färsk uppspelningslänk för en annons. Plattformarnas videolänkar gäller bara några
 * timmar och hämtas därför först när någon trycker på play.
 */
export async function GET(req: Request, { params }: RouteContext<"/api/media/[creativeId]/play">) {
  const { creativeId } = await params;
  const workspaceId = verifyMedia(creativeId, "play", new URL(req.url).searchParams);
  if (!workspaceId) return NextResponse.json({ error: "Ogiltig eller utgången länk" }, { status: 403 });
  const creative = await withTenant(workspaceId, (tx) =>
    tx.creative.findUnique({ where: { id: creativeId }, select: { externalId: true, mediaRef: true, account: { select: { connectorId: true, externalId: true, name: true, currency: true, timezone: true, connection: { select: { encryptedTokens: true } } } } } }),
  );
  if (!creative) return NextResponse.json({ error: "Annonsen finns inte" }, { status: 404 });
  const connector = getConnector(creative.account.connectorId);
  if (!connector.resolveMedia) return NextResponse.json({ error: "Uppspelning stöds inte för plattformen" }, { status: 404 });

  try {
    let tokens = JSON.parse(decryptSecret(creative.account.connection.encryptedTokens)) as TokenSet;
    const oauth = connector.auth.type === "oauth2" ? connector.auth : null;
    if (oauth && tokens.expiresAt && tokens.expiresAt < Date.now() + 60_000) tokens = await oauth.refresh(tokens);
    const a = creative.account;
    const media = await connector.resolveMedia({ tokens }, { externalId: a.externalId, name: a.name, currency: a.currency ?? undefined, timezone: a.timezone ?? undefined }, creative);
    if (!media) return NextResponse.json({ error: "Plattformen gav ingen video för annonsen" }, { status: 404 });
    return NextResponse.json(media, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("Uppspelning misslyckades", creativeId, e);
    return NextResponse.json({ error: "Kunde inte hämta videon från plattformen just nu" }, { status: 502 });
  }
}
