import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig, env } from "prisma/config";

config({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Migreringar körs som ägarrollen; appen använder DATABASE_URL (rp_app).
  datasource: { url: env("DATABASE_OWNER_URL") },
});
