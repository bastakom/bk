/** Startar simulerade Meta-, LinkedIn- och TikTok-servrar (port 4011) för utveckling och röktester. */
import { FAKE_META_TOKEN, startFakePlatforms } from "../src/dev/fake-platforms";

const fake = await startFakePlatforms({ port: Number(process.env.FAKE_PLATFORMS_PORT ?? 4011) });
console.log(`Simulerade plattformar på ${fake.url}\nMeta-token för test: ${FAKE_META_TOKEN}\n`);
for (const [k, v] of Object.entries(fake.env)) console.log(`${k}="${v}"`);
process.on("SIGINT", async () => {
  await fake.close();
  process.exit(0);
});
setInterval(() => {}, 1 << 30);
