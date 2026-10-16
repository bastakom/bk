/**
 * Exporterar all data i databasen till en mapp med en fil per tabell (JSON-rader, gzip).
 * Schemat ingår inte: det skapas av migreringarna (`pnpm --filter @rp/db migrate:deploy`).
 * Läs in med scripts/import-data.ts.
 *   pnpm --filter @rp/db exec tsx scripts/export-data.ts <mapp>
 *
 * Inloggningssessioner och engångskoder (sessions, verifications) tas inte med; alla loggar in på nytt.
 */
import { config } from "dotenv";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGzip } from "node:zlib";
import pg from "pg";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const out = resolve(process.argv[2] ?? "db-export");
const SKIP = new Set(["_prisma_migrations", "sessions", "verifications"]);
const BATCH = 2000;

const client = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
await client.connect();
mkdirSync(out, { recursive: true });
try {
  const tables = (await client.query<{ name: string }>(`SELECT relname AS name FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname`)).rows
    .map((r) => r.name)
    .filter((t) => !SKIP.has(t));
  const manifest: { exportedAt: string; migrations: string[]; tables: Record<string, number> } = {
    exportedAt: new Date().toISOString(),
    migrations: (await client.query<{ migration_name: string }>(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`)).rows.map((r) => r.migration_name),
    tables: {},
  };
  // Läs som ägare utan radfilter (ägaren är superuser lokalt).
  await client.query("SET row_security = off");
  for (const table of tables) {
    // Primärnyckel för sidindelning (keyset), så att stora tabeller läses i bitar.
    const pk = (
      await client.query<{ col: string }>(
        `SELECT a.attname AS col FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = $1::regclass AND i.indisprimary ORDER BY array_position(i.indkey, a.attnum)`,
        [`"${table}"`],
      )
    ).rows.map((r) => `"${r.col}"`);
    if (!pk.length) throw new Error(`Tabellen ${table} saknar primärnyckel.`);
    const gz = createGzip();
    const done = new Promise<void>((ok, fail) => gz.pipe(createWriteStream(resolve(out, `${table}.jsonl.gz`))).on("finish", ok).on("error", fail));
    let last: unknown[] | null = null;
    let count = 0;
    for (;;) {
      const where = last ? `WHERE (${pk.join(", ")}) > (${pk.map((_, i) => `$${i + 1}`).join(", ")})` : "";
      const { rows } = await client.query<{ j: string; k: unknown[] }>(
        `SELECT row_to_json(t)::text AS j, ARRAY[${pk.map((c) => `${c}::text`).join(", ")}] AS k FROM "${table}" t ${where} ORDER BY ${pk.join(", ")} LIMIT ${BATCH}`,
        last ?? [],
      );
      for (const r of rows) gz.write(`${r.j}\n`);
      count += rows.length;
      if (rows.length < BATCH) break;
      last = rows.at(-1)!.k;
    }
    gz.end();
    await done;
    manifest.tables[table] = count;
    console.log(`${table}: ${count} rader`);
  }
  writeFileSync(resolve(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Klart: ${out}`);
} finally {
  await client.end();
}
