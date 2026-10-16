/**
 * Läser in en export från scripts/export-data.ts i en tom databas med samma schema.
 *   1. pnpm --filter @rp/db migrate:deploy        (skapar tabeller, RLS och behörigheter)
 *   2. pnpm --filter @rp/db exec tsx scripts/import-data.ts <mapp>
 * Ansluter med DATABASE_OWNER_URL (tabellernas ägare). Tabellerna läses in i en ordning
 * där främmande nycklar alltid pekar på redan inlästa rader. Radsäkerheten (FORCE RLS)
 * stängs av per tabell under inläsningen och slås på igen efteråt.
 */
import { config } from "dotenv";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import pg from "pg";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const dir = resolve(process.argv[2] ?? "db-export");
const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8")) as { migrations: string[]; tables: Record<string, number> };
const BATCH = 500;

const client = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await client.connect();
try {
  const applied = new Set((await client.query<{ migration_name: string }>(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`)).rows.map((r) => r.migration_name));
  const missing = manifest.migrations.filter((m) => !applied.has(m));
  if (missing.length) throw new Error(`Kör migreringarna först (pnpm --filter @rp/db migrate:deploy). Saknas: ${missing.join(", ")}`);

  // Ordning: en tabell läses in först när alla tabeller den pekar på är inlästa.
  const deps = (await client.query<{ a: string; b: string }>(`SELECT conrelid::regclass::text AS a, confrelid::regclass::text AS b FROM pg_constraint WHERE contype = 'f' AND conrelid <> confrelid`)).rows;
  const clean = (t: string) => t.replaceAll('"', "");
  const tables = Object.keys(manifest.tables);
  const order: string[] = [];
  while (order.length < tables.length) {
    const next = tables.find((t) => !order.includes(t) && deps.filter((d) => clean(d.a) === t).every((d) => order.includes(clean(d.b)) || !tables.includes(clean(d.b))));
    if (!next) throw new Error("Kunde inte bestämma ordningen mellan tabellerna.");
    order.push(next);
  }

  for (const table of order) {
    const { rows } = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`);
    if (rows[0]!.n > 0) throw new Error(`Tabellen ${table} är inte tom – importen görs bara till en tom databas.`);
  }

  for (const table of order) {
    const file = resolve(dir, `${table}.jsonl.gz`);
    if (!existsSync(file)) continue;
    const { rows: rls } = await client.query<{ force: boolean }>(`SELECT relforcerowsecurity AS force FROM pg_class WHERE oid = $1::regclass`, [`"${table}"`]);
    const force = rls[0]?.force ?? false;
    await client.query("BEGIN");
    try {
      if (force) await client.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
      let batch: string[] = [];
      let count = 0;
      const flush = async () => {
        if (!batch.length) return;
        await client.query(`INSERT INTO "${table}" SELECT * FROM json_populate_recordset(NULL::"${table}", $1::json)`, [`[${batch.join(",")}]`]);
        count += batch.length;
        batch = [];
      };
      for await (const line of createInterface({ input: createReadStream(file).pipe(createGunzip()) })) {
        if (!line) continue;
        batch.push(line);
        if (batch.length >= BATCH) await flush();
      }
      await flush();
      if (force) await client.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await client.query("COMMIT");
      console.log(`${table}: ${count} rader`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  // Räknare för id-kolumner med autoincrement (t.ex. metric_facts.id) ställs efter inlästa rader.
  const seqs = (
    await client.query<{ t: string; c: string; s: string }>(
      `SELECT c.relname AS t, a.attname AS c, pg_get_serial_sequence(format('%I', c.relname), a.attname) AS s FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped AND pg_get_serial_sequence(format('%I', c.relname), a.attname) IS NOT NULL`,
    )
  ).rows;
  for (const q of seqs) await client.query(`SELECT setval($1, COALESCE((SELECT max("${q.c}") FROM "${q.t}"), 0) + 1, false)`, [q.s]);
  console.log("Klart.");
} finally {
  await client.end();
}
