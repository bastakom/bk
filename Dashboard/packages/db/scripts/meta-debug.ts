/** Felsökning: rå Graph API-svar för ett Meta-konto. tsx scripts/meta-debug.ts <accountId> <path> [fält-JSON] */
import { config } from "dotenv";
import { createHmac } from "node:crypto";
import { resolve } from "node:path";
config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const { decryptSecret } = await import("@rp/core/server");
const { createOwnerClient } = await import("../src/index");
const [id, path, params = "{}"] = process.argv.slice(2);
const db = createOwnerClient();
const acc = await db.connectedAccount.findUniqueOrThrow({ where: { id: id! }, include: { connection: true } });
await db.$disconnect();
const { accessToken } = JSON.parse(decryptSecret(acc.connection.encryptedTokens));
const url = new URL(`https://graph.facebook.com/${process.env.META_API_VERSION ?? "v23.0"}/${path!.replace("{act}", acc.externalId)}`);
for (const [k, v] of Object.entries(JSON.parse(params))) url.searchParams.set(k, String(v));
if (process.env.META_APP_SECRET) url.searchParams.set("appsecret_proof", createHmac("sha256", process.env.META_APP_SECRET).update(accessToken).digest("hex"));
url.searchParams.set("access_token", accessToken);
const res = await fetch(url);
console.log(res.status, JSON.stringify(await res.json(), null, 1));
