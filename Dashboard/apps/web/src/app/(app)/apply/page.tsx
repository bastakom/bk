import { dashboardToDefinition, type TemplateDefinition } from "@rp/db";
import type { PlatformId } from "@rp/core";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRolePage } from "@/lib/dal";
import { MappingForm } from "./mapping-form";

export const metadata = { title: "Mappa källor" };

/**
 * Applicera en mall (?template=ID) eller kopiera en dashboard (?dashboard=ID)
 * till en kund (?client=slug) genom att mappa källorna mot kundens konton.
 */
export default async function ApplyPage({ searchParams }: PageProps<"/apply">) {
  const sp = await searchParams;
  const templateId = typeof sp.template === "string" ? sp.template : undefined;
  const dashboardId = typeof sp.dashboard === "string" ? sp.dashboard : undefined;
  const clientSlug = typeof sp.client === "string" ? sp.client : undefined;
  const ctx = await requireRolePage("EDITOR");

  const data = await ctx.tx(async (tx) => {
    let definition: TemplateDefinition;
    let sourceName: string;
    if (templateId) {
      const t = await tx.dashboardTemplate.findFirst({ where: { id: templateId } });
      if (!t) return null;
      definition = t.definition as unknown as TemplateDefinition;
      sourceName = t.name;
    } else if (dashboardId) {
      const d = await tx.dashboard.findFirst({ where: { id: dashboardId }, include: { client: { select: { name: true } } } });
      if (!d) return null;
      definition = await dashboardToDefinition(tx, d.id);
      sourceName = `${d.name}`;
    } else return null;

    const clients = await tx.client.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, sources: { select: { account: { select: { id: true, name: true, platform: true, currency: true } } }, orderBy: { account: { name: "asc" } } } },
    });
    return { definition, sourceName, clients };
  });
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <PageHeader
        title={templateId ? `Använd mallen "${data.sourceName}"` : `Kopiera "${data.sourceName}"`}
        description="Välj kund och koppla varje källa i mallen till en av kundens valda källor. Källor du hoppar över lämnar widgetarna tomma tills du väljer konto."
      />
      <MappingForm
        source={templateId ? { kind: "template", id: templateId } : { kind: "dashboard", id: dashboardId! }}
        defaultName={data.sourceName}
        slots={data.definition.slots.map((s) => ({ ...s, platform: s.platform as PlatformId, widgets: data.definition.widgets.filter((w) => w.slots.includes(s.key)).length }))}
        widgetCount={data.definition.widgets.length}
        clients={data.clients.map(({ sources, ...c }) => ({ ...c, accounts: sources.map(({ account: a }) => ({ ...a, platform: a.platform as PlatformId })) }))}
        initialClient={data.clients.find((c) => c.slug === clientSlug)?.id}
      />
    </div>
  );
}
