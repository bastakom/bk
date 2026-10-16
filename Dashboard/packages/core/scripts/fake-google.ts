/**
 * Startar den simulerade Google-servern för lokal utveckling:
 *   pnpm fake-google            (port 4010)
 * och lägg in de utskrivna variablerna i .env (gjort i demo-.env).
 */
import { startFakeGoogle } from "../src/dev/fake-google";

const fake = await startFakeGoogle({ port: Number(process.env.FAKE_GOOGLE_PORT ?? 4010) });
console.log(`Simulerad Google-server på ${fake.url}\n`);
for (const [k, v] of Object.entries(fake.env)) console.log(`${k}="${v}"`);
process.on("SIGINT", async () => {
  await fake.close();
  process.exit(0);
});
setInterval(() => {}, 1 << 30);
