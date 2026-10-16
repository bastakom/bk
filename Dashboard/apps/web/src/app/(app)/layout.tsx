import { cookies } from "next/headers";
import { requireWorkspace } from "@/lib/dal";
import { AppShell, SIDEBAR_COOKIE } from "./app-shell";
import { loadShellData } from "./shell-data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireWorkspace();
  // Appen har alltid Bästa Kompisars stil; byråns egen färg och typsnitt (white label) gäller det kunderna ser.
  const [nav, jar] = await Promise.all([loadShellData(ctx), cookies()]);
  return (
    <div className="font-sans">
      <AppShell
        user={ctx.user}
        workspace={{ id: ctx.workspace.id, name: ctx.workspace.name }}
        workspaces={ctx.workspaces}
        role={ctx.role}
        clients={nav.clients}
        dashboards={nav.dashboards}
        notices={nav.notices}
        counts={nav.counts}
        onboarding={nav.onboarding}
        collapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      >
        {children}
      </AppShell>
    </div>
  );
}
