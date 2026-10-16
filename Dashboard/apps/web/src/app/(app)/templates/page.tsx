import type { TemplateDefinition } from "@rp/db";
import { LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PlatformIcon } from "@/components/platform-icon";
import { requireWorkspace } from "@/lib/dal";
import { timeAgo } from "@/lib/format";
import { TemplateActions } from "./template-actions";

export const metadata = { title: "Mallar" };

export default async function TemplatesPage() {
  const ctx = await requireWorkspace();
  const templates = await ctx.tx((tx) => tx.dashboardTemplate.findMany({ orderBy: { updatedAt: "desc" } }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeader title="Mallar" description="Dashboards sparade på byrånivå. Använd en mall på en kund och mappa bara källorna." />
      {templates.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/50 px-6 py-20 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
            <LayoutTemplate className="size-5" />
          </span>
          <p className="mt-4 font-medium">Inga mallar än</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Öppna en dashboard och välj &quot;Spara som mall&quot; i menyn.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const def = t.definition as unknown as TemplateDefinition;
            return (
              <li key={t.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{t.name}</p>
                  <span className="flex -space-x-1">
                    {[...new Set(def.slots.map((s) => s.platform))].map((p) => (
                      <PlatformIcon key={p} platform={p} size="sm" className="ring-2 ring-card" />
                    ))}
                  </span>
                </div>
                {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
                <p className="mt-3 text-xs text-muted-foreground">
                  {def.widgets.length} widgets · {def.slots.length} källor · uppdaterad {timeAgo(t.updatedAt)}
                </p>
                <div className="mt-4 flex flex-1 items-end">
                  <TemplateActions id={t.id} name={t.name} canEdit={ctx.can("EDITOR")} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
