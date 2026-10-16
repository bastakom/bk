import { oauthOf } from "@rp/core";
import { getConnector } from "@rp/core/server";
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireRolePage } from "@/lib/dal";
import { redirectUri, savePendingOAuth } from "@/lib/oauth";

/** Startar OAuth-flödet mot en connector (från Databaser). `reconnect` = inloggningen som ersätts. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/connect/[connectorId]/start">) {
  const { connectorId } = await params;
  await requireRolePage("ADMIN");
  const reconnect = req.nextUrl.searchParams.get("reconnect") ?? undefined;

  const connector = getConnector(connectorId);
  // Token-kopplingar (t.ex. Meta) har ingen redirect: visa inklistringen i Databaser i stället.
  if (connector.auth.type === "token") {
    const q = new URLSearchParams({ connector: connector.id });
    if (reconnect) q.set("reconnect", reconnect);
    return NextResponse.redirect(new URL(`/databases?${q}`, req.url));
  }
  if (connector.isConfigured && !connector.isConfigured()) {
    return NextResponse.redirect(new URL("/databases?error=not_configured", req.url));
  }
  const state = randomBytes(24).toString("base64url");
  await savePendingOAuth({ state, connectorId, reconnectConnectionId: reconnect });
  return NextResponse.redirect(oauthOf(connector).getAuthorizationUrl({ state, redirectUri: redirectUri() }));
}
