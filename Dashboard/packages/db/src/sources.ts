/**
 * Byråns databaser: alla konton som en inloggning ger åtkomst till sparas som
 * källor (connected_accounts) på byrånivå. Kunder väljer källor via
 * client_sources; bara valda källor synkas.
 */
import type { ExternalAccount, TokenSet } from "@rp/core";
import { decryptSecret, getConnector } from "@rp/core/server";
import type { DbRunner } from "./sync";
import type { TenantTx } from "./index";

export interface DiscoverResult {
  /** Nya källor som inte fanns förut */
  added: number;
  /** Källor som fanns och uppdaterades (namn, valuta, tidszon) */
  updated: number;
  /** Totalt antal konton inloggningen ger åtkomst till */
  total: number;
}

/**
 * Sparar konton som källor under inloggningen. Ett konto som redan finns under en
 * annan inloggning (t.ex. efter "Koppla om") flyttas hit, så att data och kundval behålls.
 */
export async function upsertSources(db: DbRunner | TenantTx, connectionId: string, accounts: ExternalAccount[]): Promise<DiscoverResult> {
  const run: DbRunner = typeof db === "function" ? db : (fn) => fn(db);
  return run(async (tx) => {
    const conn = await tx.connection.findUniqueOrThrow({ where: { id: connectionId } });
    const existing = await tx.connectedAccount.findMany({
      where: { workspaceId: conn.workspaceId, connectorId: conn.connectorId, externalId: { in: accounts.map((a) => a.externalId) } },
      select: { externalId: true },
    });
    const known = new Set(existing.map((e) => e.externalId));
    for (const a of accounts) {
      const data = { name: a.name, currency: a.currency ?? "SEK", timezone: a.timezone ?? "Europe/Stockholm", connectionId };
      await tx.connectedAccount.upsert({
        where: { workspaceId_connectorId_externalId: { workspaceId: conn.workspaceId, connectorId: conn.connectorId, externalId: a.externalId } },
        create: { ...data, workspaceId: conn.workspaceId, connectorId: conn.connectorId, platform: conn.platform, externalId: a.externalId },
        update: data,
      });
    }
    return { added: accounts.length - known.size, updated: known.size, total: accounts.length };
  });
}

/** Läser om vilka konton inloggningen ger åtkomst till och sparar dem som källor. */
export async function discoverSources(db: DbRunner | TenantTx, connectionId: string): Promise<DiscoverResult> {
  const run: DbRunner = typeof db === "function" ? db : (fn) => fn(db);
  const conn = await run((tx) => tx.connection.findUniqueOrThrow({ where: { id: connectionId } }));
  const connector = getConnector(conn.connectorId);
  let tokens = JSON.parse(decryptSecret(conn.encryptedTokens)) as TokenSet;
  if (connector.auth.type === "oauth2" && tokens.expiresAt && tokens.expiresAt < Date.now() + 60_000) tokens = await connector.auth.refresh(tokens);
  const accounts = await connector.listAccounts({ tokens });
  return upsertSources(db, connectionId, accounts);
}
