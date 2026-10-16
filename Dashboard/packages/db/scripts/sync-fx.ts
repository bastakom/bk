/** Hämtar ECB-kurser: `pnpm --filter @rp/db fx:sync [från-datum]` */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const { createOwnerClient, syncFxRates } = await import("../src/index");
const prisma = createOwnerClient();
const from = process.argv[2] ?? new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
console.log(`Hämtade ${await syncFxRates(prisma, from)} kurser från ${from}.`);
await prisma.$disconnect();
