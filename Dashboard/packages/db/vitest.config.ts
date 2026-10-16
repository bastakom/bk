import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

config({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({ test: { testTimeout: 30_000, fileParallelism: false } });
