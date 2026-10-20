import "server-only";
import { enqueueAccountHistory, syncAccount, type DbRunner, type SyncOptions } from "@rp/db";
import { handleSyncOutcome } from "@rp/reports";
import { appUrl } from "./app-url";

/** Synkar ett konto från appen och larmar vid statusövergång (samma logik som workern). */
export async function syncAndAlert(db: DbRunner, accountId: string, opts: SyncOptions = {}) {
  const res = await syncAccount(db, accountId, opts);
  await handleSyncOutcome(db, accountId, res, { baseUrl: appUrl() });
  return res;
}

/**
 * Synkar en inloggnings källor som någon kund använder (efter ny inloggning eller
 * "Koppla om"). Källor utan kund synkas inte – de hämtar data först när de väljs.
 */
export async function syncUsedSources(db: DbRunner, connectionId: string) {
  const ids = await db((tx) =>
    tx.connectedAccount.findMany({ where: { connectionId, clientSources: { some: {} } }, select: { id: true, lastSyncedAt: true } }),
  );
  for (const a of ids) {
    if (!a.lastSyncedAt) await db((tx) => enqueueAccountHistory(tx, a.id));
    else await syncAndAlert(db, a.id, { days: 30 });
  }
}

/** Lägger första historiska synken i kön och returnerar utan att vänta på API-anrop. */
export async function syncNewSources(db: DbRunner, accountIds: string[]) {
  const fresh = await db((tx) => tx.connectedAccount.findMany({ where: { id: { in: accountIds }, lastSyncedAt: null }, select: { id: true } }));
  for (const a of fresh) await db((tx) => enqueueAccountHistory(tx, a.id));
}

/**
 * Efter "Koppla om": den ersatta inloggningen tas bort om alla dess konton flyttats
 * till den nya; annars markeras den återkallad (kvarvarande konton saknar åtkomst).
 */
export async function retireConnection(db: DbRunner, connectionId: string) {
  await db(async (tx) => {
    const left = await tx.connectedAccount.count({ where: { connectionId } });
    if (left === 0) await tx.connection.deleteMany({ where: { id: connectionId } });
    else await tx.connection.updateMany({ where: { id: connectionId }, data: { status: "REVOKED" } });
  });
}
