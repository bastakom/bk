/**
 * Data access layer: all inloggnings- och behörighetskontroll samlad här.
 * Server components och server actions hämtar aldrig tenant-data utan att gå
 * via requireWorkspace(), som returnerar en tenant-bunden databasåtkomst.
 */
import "server-only";
import { db, withTenant, type Role, type TenantTx } from "@rp/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export const ACTIVE_WORKSPACE_COOKIE = "rp_ws";

const ROLE_RANK: Record<Role, number> = { CLIENT: -1, VIEWER: 0, EDITOR: 1, ADMIN: 2 };

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

export interface WorkspaceContext {
  user: { id: string; name: string; email: string };
  workspace: { id: string; name: string; slug: string; brandColor: string; logoUrl: string | null };
  role: Role;
  workspaces: { id: string; name: string }[];
  /** Kunder personen får se, eller null = alla byråns kunder. Gäller även i databasen (RLS). */
  clientIds: string[] | null;
  /** Kör en databasoperation bunden till den aktiva byrån (row level security). */
  tx<T>(fn: (tx: TenantTx) => Promise<T>): Promise<T>;
  can(min: Role): boolean;
}

/** Kunder en medlem får se: admin alla, kundinloggning bara sina, övriga valda kunder (tom lista = alla). */
export function allowedClientIds(m: { role: Role; clientIds: string[] }): string[] | null {
  if (m.role === "ADMIN") return null;
  if (m.role === "CLIENT") return m.clientIds;
  return m.clientIds.length ? m.clientIds : null;
}

const loadWorkspace = cache(async (): Promise<WorkspaceContext> => {
  const user = await requireUser();
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) redirect("/onboarding");

  const wanted = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspaceId === wanted) ?? memberships[0]!;
  const { workspace } = active;
  const clientIds = allowedClientIds(active);

  return {
    user: { id: user.id, name: user.name, email: user.email },
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, brandColor: workspace.brandColor, logoUrl: workspace.logoUrl },
    role: active.role,
    workspaces: memberships.map((m) => ({ id: m.workspaceId, name: m.workspace.name })),
    clientIds,
    tx: (fn) => withTenant(workspace.id, fn, db, { clientIds }),
    can: (min) => ROLE_RANK[active.role] >= ROLE_RANK[min],
  };
});

/** Byråns app. Kundinloggningar skickas till kundportalen. */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const ctx = await loadWorkspace();
  if (ctx.role === "CLIENT") redirect("/portal");
  return ctx;
}

/** Kundportalen: kundinloggningar och byråns personal (för förhandsvisning). */
export const requirePortal = loadWorkspace;

export class PermissionError extends Error {}

const ROLE_LABEL: Record<Role, string> = { CLIENT: "kund", VIEWER: "läsare", EDITOR: "redaktör", ADMIN: "admin" };

/**
 * För server actions: kastar om användaren saknar rätt roll.
 * `allClients`: kräver tillgång till alla kunder (t.ex. skapa kunder eller välja bland byråns källor).
 */
export async function requireRole(min: Role, opts: { allClients?: boolean } = {}) {
  const ctx = await requireWorkspace();
  if (!ctx.can(min)) throw new PermissionError(`Kräver minst rollen ${ROLE_LABEL[min]}.`);
  if (opts.allClients && ctx.clientIds) throw new PermissionError("Du har bara tillgång till vissa kunder. Be en admin om hjälp.");
  return ctx;
}

/** För sidor och route handlers: skickar till en vänlig "ingen behörighet"-sida. */
export async function requireRolePage(min: Role) {
  const ctx = await requireWorkspace();
  if (!ctx.can(min)) redirect("/no-access");
  return ctx;
}
