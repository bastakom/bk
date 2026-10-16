/**
 * Startar en lokal PostgreSQL 18 (embedded-postgres) för utveckling, utan Docker.
 * Data sparas i .pgdata i repots rot. Skapar databasen och app-rollen rp_app
 * (utan BYPASSRLS) första gången.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(import.meta.dirname, "../../../.pgdata");
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres_dev", port: 5433, persistent: true });

const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();

const client = pg.getPgClient();
await client.connect();
const db = await client.query("SELECT 1 FROM pg_database WHERE datname = 'rapport'");
if (db.rowCount === 0) await pg.createDatabase("rapport");
const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'rp_app'");
if (role.rowCount === 0) await client.query("CREATE ROLE rp_app LOGIN PASSWORD 'rp_app_dev' NOSUPERUSER NOBYPASSRLS");
await client.end();

console.log("PostgreSQL kör på localhost:5433 (databas: rapport). Ctrl+C för att stoppa.");
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
