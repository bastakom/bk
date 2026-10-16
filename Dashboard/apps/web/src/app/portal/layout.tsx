import type { Metadata } from "next";
import { requirePortal } from "@/lib/dal";
import { portalDashboards, portalLang } from "./data";
import { PortalBar } from "./portal-bar";

export const metadata: Metadata = { title: "Rapporter", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const ctx = await requirePortal();
  const dashboards = await portalDashboards(ctx);
  const lang = portalLang(dashboards.map((d) => d.client.locale));
  return (
    <div className="min-h-svh bg-background">
      <PortalBar user={ctx.user.name} agency={ctx.workspace.name} en={lang === "en"} staff={ctx.role !== "CLIENT"} />
      {children}
    </div>
  );
}
