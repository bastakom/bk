import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export * from "./generated/prisma/client";
export { ownerRunner, syncAccount, type DbRunner, type SyncOptions, type SyncResult } from "./sync";
export * from "./sync-queue";
export * from "./sync-job-runner";
export * from "./templates";
export * from "./sources";
export * from "./fx";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
export type TenantTx = Tx;

const globalForPrisma = globalThis as unknown as { __rpPrisma?: PrismaClient };

function createClient(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL saknas");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/**
 * Appens databasklient (rollen rp_app, row level security gäller). Tenant-tabeller
 * returnerar inga rader förrän workspace satts via withTenant().
 * Skapas vid första användning, så att moduler kan importeras utan databas (t.ex. i enhetstester).
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = (globalForPrisma.__rpPrisma ??= createClient(process.env.DATABASE_URL));
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Kör `fn` i en transaktion där Postgres vet vilken byrå som är aktiv.
 * All åtkomst till kunder, konton, dashboards och data går via denna.
 */
export function withTenant<T>(workspaceId: string, fn: (tx: Tx) => Promise<T>, client: PrismaClient = db, opts: { clientIds?: string[] | null } = {}): Promise<T> {
  return client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      // Behörighet per kund (se policyn client_access). "," matchar ingen kund.
      if (opts.clientIds) await tx.$executeRaw`SELECT set_config('app.client_ids', ${opts.clientIds.join(",") || ","}, true)`;
      return fn(tx);
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}

/** Klient med ägarrollen – endast för migreringar, seed och systemjobb. */
export const createOwnerClient = () => createClient(process.env.DATABASE_OWNER_URL);
