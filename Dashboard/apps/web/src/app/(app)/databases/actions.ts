"use server";

import { ConnectorAuthError } from "@rp/core";
import { encryptSecret, getConnector } from "@rp/core/server";
import { discoverSources } from "@rp/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { runAction } from "@/lib/actions";
import { requireRole } from "@/lib/dal";
import { retireConnection, syncUsedSources } from "@/lib/sync";

const tokenInput = z.object({
  connectorId: z.string().min(1),
  token: z.string().trim().min(20, "Token ser för kort ut").max(4000),
  reconnect: z.string().optional(),
});

/** Kopplar en plattform med en inklistrad token (t.ex. Metas systemanvändare). */
export async function connectWithToken(_: unknown, form: FormData) {
  const result = await runAction(async () => {
    const ctx = await requireRole("ADMIN");
    const v = tokenInput.parse(Object.fromEntries(form));
    const connector = getConnector(v.connectorId);
    if (connector.auth.type !== "token") throw new Error("Connectorn använder inte token-inloggning");
    let validated;
    try {
      validated = await connector.auth.validate(v.token);
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof ConnectorAuthError ? "Token godkändes inte av plattformen. Kontrollera att den är rätt kopierad och har behörigheten ads_read." : "Kunde inte kontrollera token just nu. Försök igen.",
      };
    }
    const auth = connector.auth;
    const connection = await ctx.tx((tx) =>
      tx.connection.create({
        data: {
          workspaceId: ctx.workspace.id,
          connectorId: connector.id,
          platform: connector.platform,
          label: validated.label,
          scopes: auth.scopes,
          encryptedTokens: encryptSecret(JSON.stringify(validated.tokens)),
          createdById: ctx.user.id,
        },
        select: { id: true },
      }),
    );
    let found: { total: number };
    try {
      found = await discoverSources(ctx.tx, connection.id);
    } catch (err) {
      // Token är sparad men kontona kunde inte hämtas; användaren kan försöka igen med "Uppdatera kontolista".
      console.error(JSON.stringify({ event: "discover_failed", connector: connector.id, error: err instanceof Error ? err.message.slice(0, 300) : String(err) }));
      return { ok: true as const, data: `/databases?oauth=list_failed&connection=${connection.id}` };
    }
    await ctx.tx((tx) => tx.connectedAccount.updateMany({ where: { connectionId: connection.id, status: "AUTH_REQUIRED" }, data: { status: "PENDING", statusMessage: null } }));
    if (v.reconnect) await retireConnection(ctx.tx, v.reconnect);
    after(() => syncUsedSources(ctx.tx, connection.id));
    return { ok: true as const, data: `/databases?oauth=${v.reconnect ? "reconnected" : "connected"}&found=${found.total}&connection=${connection.id}` };
  });
  if (result.ok && result.data) redirect(result.data);
  return result;
}

/** Läser om vilka konton inloggningen ger åtkomst till (nya konton läggs till, namn uppdateras). */
export async function refreshConnection(connectionId: string) {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    try {
      const r = await discoverSources(ctx.tx, connectionId);
      revalidatePath("/databases");
      return { ok: true as const, message: r.added ? `${r.added} nya konton hittades (totalt ${r.total}).` : `Kontolistan är uppdaterad (${r.total} konton).` };
    } catch (e) {
      if (e instanceof ConnectorAuthError) {
        await ctx.tx((tx) => tx.connection.update({ where: { id: connectionId }, data: { status: "REVOKED" } }));
        revalidatePath("/databases");
        return { ok: false as const, error: "Inloggningen fungerar inte längre. Koppla om den." };
      }
      throw e;
    }
  });
}

/**
 * Tar bort inloggningen med alla dess källor och deras synkade data (GDPR).
 * Kundernas val av källorna försvinner, och widgets som använder dem slutar visa data.
 */
export async function removeConnection(connectionId: string) {
  return runAction(async () => {
    const ctx = await requireRole("ADMIN");
    await ctx.tx((tx) => tx.connection.delete({ where: { id: connectionId } }));
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Inloggningen och dess data är borttagna." };
  });
}
