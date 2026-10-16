import { oauthOf } from "@rp/core";
import { encryptSecret, getConnector, GoogleAdsAccessError } from "@rp/core/server";
import { discoverSources } from "@rp/db";
import { after, NextResponse, type NextRequest } from "next/server";
import { requireRolePage } from "@/lib/dal";
import { consumePendingOAuth, redirectUri } from "@/lib/oauth";
import { retireConnection, syncUsedSources } from "@/lib/sync";

/**
 * OAuth-callback: byter kod mot tokens, sparar inloggningen krypterat och läser in
 * alla konton den ger åtkomst till som källor i Databaser.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireRolePage("ADMIN");
  const q = req.nextUrl.searchParams;
  const pending = await consumePendingOAuth(q.get("state"));
  const back = new URL("/databases", req.url);
  if (!pending) {
    back.searchParams.set("oauth", "invalid_state");
    return NextResponse.redirect(back);
  }
  if (q.get("error")) {
    back.searchParams.set("oauth", "denied");
    return NextResponse.redirect(back);
  }

  const connector = getConnector(pending.connectorId);
  const tokens = await oauthOf(connector).exchangeCode({ code: q.get("code") ?? q.get("auth_code") ?? "", redirectUri: redirectUri() });
  const connection = await ctx.tx((tx) =>
    tx.connection.create({
      data: {
        workspaceId: ctx.workspace.id,
        connectorId: connector.id,
        platform: connector.platform,
        label: tokens.extra?.email ?? ctx.user.email,
        scopes: connector.auth.scopes,
        encryptedTokens: encryptSecret(JSON.stringify(tokens)),
        createdById: ctx.user.id,
      },
    }),
  );
  // Konton som redan fanns (under en tidigare inloggning) flyttas hit; kundernas val och data behålls.
  let found: { total: number };
  try {
    found = await discoverSources(ctx.tx, connection.id);
  } catch (err) {
    // Inloggningen är sparad; kontolistan kunde inte hämtas (t.ex. Google Ads-åtkomstnivå Test).
    console.error(JSON.stringify({ event: "discover_failed", connector: connector.id, error: err instanceof Error ? err.message.slice(0, 300) : String(err) }));
    back.searchParams.set("oauth", err instanceof GoogleAdsAccessError ? `ads_${err.code}` : "list_failed");
    back.searchParams.set("connection", connection.id);
    return NextResponse.redirect(back);
  }
  await ctx.tx((tx) => tx.connectedAccount.updateMany({ where: { connectionId: connection.id, status: "AUTH_REQUIRED" }, data: { status: "PENDING", statusMessage: null } }));
  if (pending.reconnectConnectionId && pending.reconnectConnectionId !== connection.id) {
    await retireConnection(ctx.tx, pending.reconnectConnectionId);
  }
  // Källor som kunder använder synkas efter svaret, så att användaren inte behöver vänta.
  after(() => syncUsedSources(ctx.tx, connection.id));

  back.searchParams.set("oauth", pending.reconnectConnectionId ? "reconnected" : "connected");
  back.searchParams.set("found", String(found.total));
  back.searchParams.set("connection", connection.id);
  return NextResponse.redirect(back);
}
