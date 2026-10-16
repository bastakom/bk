/** Felsökning: kör connectorns annonshämtning för ett konto. tsx scripts/creatives-debug.ts <accountId> [play] */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const { decryptSecret, getConnector } = await import("@rp/core/server");
const { createOwnerClient } = await import("../src/index");
const [id, play] = process.argv.slice(2);
const db = createOwnerClient();
const acc = await db.connectedAccount.findUniqueOrThrow({ where: { id: id! }, include: { connection: true } });
await db.$disconnect();
const tokens = JSON.parse(decryptSecret(acc.connection.encryptedTokens));
const conn = getConnector(acc.connectorId);
const t = Date.now();
const ads = await conn.fetchCreatives!({ tokens }, acc);
console.log(`${ads.length} annonser på ${((Date.now() - t) / 1000).toFixed(1)} s`);
for (const a of ads) console.log([a.name, a.format, a.headline ? "rubrik" : "-", a.text ? `text ${a.text.length}` : "INGEN TEXT", a.thumbnailUrl ? new URL(a.thumbnailUrl).pathname.slice(0, 40) : "INGEN BILD", a.mediaRef ?? ""].join(" | "));
if (play) {
  for (const a of ads.filter((x) => x.format === "video").slice(0, 4)) {
    const m = await conn.resolveMedia!({ tokens }, acc, a);
    console.log("PLAY", a.name, m?.kind, m?.url.slice(0, 70));
  }
}
