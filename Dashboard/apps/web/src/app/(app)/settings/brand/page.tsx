import { db } from "@rp/db";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/dal";
import { SettingsNav } from "../settings-nav";
import { appHost, domainToken, TXT_PREFIX, workspaceWhiteLabel } from "@/lib/white-label";
import { BrandForm } from "./brand-form";
import { WhiteLabelForm } from "./white-label-form";

export const metadata = { title: "Varumärke" };

export default async function BrandPage() {
  const ctx = await requireWorkspace();
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspace.id }, select: { name: true, brandColor: true, fontFamily: true, logoUrl: true } });
  const wl = await workspaceWhiteLabel(ctx.workspace.id);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <PageHeader title="Inställningar" description={ctx.workspace.name} />
      <SettingsNav />
      <BrandForm initial={ws} canEdit={ctx.can("ADMIN")} />
      <WhiteLabelForm
        key={`${wl.customDomain}|${wl.emailFrom}|${wl.emailFromName}|${!!wl.domainVerifiedAt}|${!!wl.emailVerifiedAt}`}
        initial={{ customDomain: wl.customDomain ?? "", emailFromName: wl.emailFromName ?? "", emailFrom: wl.emailFrom ?? "" }}
        domainVerified={!!wl.domainVerifiedAt}
        senderVerified={!!wl.emailVerifiedAt}
        dns={{ appHost: appHost().split(":")[0]!, txtName: `${TXT_PREFIX}.${wl.customDomain ?? ""}`, txtValue: domainToken(ctx.workspace.id) }}
        canEdit={ctx.can("ADMIN")}
      />
    </div>
  );
}
