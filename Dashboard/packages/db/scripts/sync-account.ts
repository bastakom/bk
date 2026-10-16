/**
 * Synkar ett kopplat konto direkt (felsökning).
 *   pnpm --filter @rp/db exec tsx scripts/sync-account.ts <accountId>
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const { createOwnerClient, ownerRunner, syncAccount } = await import("../src/index");

const id = process.argv[2];
if (!id) throw new Error("Ange konto-id.");
const client = createOwnerClient();
const t = Date.now();
try {
  console.log(await syncAccount(ownerRunner(client), id), `${((Date.now() - t) / 1000).toFixed(1)} s`);
} finally {
  await client.$disconnect();
}
