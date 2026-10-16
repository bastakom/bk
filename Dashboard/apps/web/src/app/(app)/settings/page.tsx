import { db } from "@rp/db";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/dal";
import { MembersTable } from "./members-table";
import { SettingsNav } from "./settings-nav";

export const metadata = { title: "Inställningar" };

export default async function SettingsPage() {
  const ctx = await requireWorkspace();
  // memberships omfattas inte av RLS (de behövs för att välja byrå); filtrera explicit.
  const members = await db.membership.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const invitations = ctx.can("ADMIN")
    ? await db.invitation.findMany({ where: { workspaceId: ctx.workspace.id, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" } })
    : [];
  const clients = await ctx.tx((tx) => tx.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <PageHeader title="Inställningar" description={ctx.workspace.name} />
      <SettingsNav />
      <section aria-labelledby="team-heading" className="space-y-4">
        <div>
          <h2 id="team-heading" className="text-xl font-bold tracking-tight text-heading">
            Team och roller
          </h2>
          <p className="text-sm text-muted-foreground">Admin hanterar team, källor och kunder. Redaktör bygger rapporter, läsare ser utan att ändra. Båda kan begränsas till vissa kunder. Rollen Kund ger kunden en egen inloggning till kundportalen.</p>
        </div>
        <MembersTable
          canManage={ctx.can("ADMIN")}
          currentUserId={ctx.user.id}
          members={members.map((m) => ({ id: m.id, role: m.role, clientIds: m.clientIds, name: m.user.name, email: m.user.email, userId: m.user.id }))}
          invitations={invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, clientIds: i.clientIds, expiresAt: i.expiresAt.toISOString() }))}
          clients={clients}
        />
      </section>
    </div>
  );
}
