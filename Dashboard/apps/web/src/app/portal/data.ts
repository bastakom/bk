import "server-only";
import { langOf, type Lang } from "@rp/core";
import { db } from "@rp/db";
import type { WorkspaceContext } from "@/lib/dal";

/** Rapporter i kundportalen: dashboards som byrån valt att visa, för kunder personen har tillgång till. */
export async function portalDashboards(ctx: WorkspaceContext) {
  return ctx.tx((tx) =>
    tx.dashboard.findMany({
      where: { inPortal: true },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, description: true, updatedAt: true, client: { select: { id: true, name: true, locale: true, logoUrl: true, primaryColor: true } } },
    }),
  );
}

/** Portalens språk: kundens språk om alla rapporter hör till kunder med samma språk, annars svenska. */
export function portalLang(locales: string[]): Lang {
  const langs = new Set(locales.map(langOf));
  return langs.size === 1 ? [...langs][0]! : "sv";
}

export const workspaceBrand = (id: string) =>
  db.workspace.findUniqueOrThrow({ where: { id }, select: { name: true, logoUrl: true, brandColor: true, fontFamily: true } });
