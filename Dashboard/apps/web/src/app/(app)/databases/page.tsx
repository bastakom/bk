import { PLATFORMS, type PlatformId } from "@rp/core";
import { getConnector, listConnectors } from "@rp/core/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/dal";
import { timeAgo } from "@/lib/format";
import { OAuthToast } from "../clients/[clientSlug]/oauth-toast";
import { ConnectDialog, type ConnectorOption } from "./connect-dialog";
import { ConnectionCard, type ConnectionView } from "./connection-card";
import { TokenDialog } from "./token-dialog";

export const metadata = { title: "Databaser" };

const PLATFORM_ORDER: PlatformId[] = ["ga4", "google_ads", "meta_ads", "linkedin_ads", "tiktok_ads"];

export default async function DatabasesPage({ searchParams }: PageProps<"/databases">) {
  const sp = await searchParams;
  const ctx = await requireWorkspace();
  const isAdmin = ctx.can("ADMIN");
  // Demokopplingar kan stängas av i produktion med SHOW_MOCK_CONNECTORS=false.
  const showMock = process.env.SHOW_MOCK_CONNECTORS !== "false";

  const connections = await ctx.tx((tx) =>
    tx.connection.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        accounts: {
          orderBy: { name: "asc" },
          include: { clientSources: { select: { client: { select: { name: true, slug: true } } } } },
        },
      },
    }),
  );

  const views: ConnectionView[] = connections
    .map((c) => {
      const connector = getConnector(c.connectorId);
      return {
        id: c.id,
        connectorId: c.connectorId,
        platform: c.platform as PlatformId,
        platformLabel: PLATFORMS[c.platform as PlatformId]?.label ?? c.platform,
        label: c.label,
        isMock: !!connector.isMock,
        authType: connector.auth.type,
        status: c.status,
        createdAgo: timeAgo(c.createdAt),
        accounts: c.accounts.map((a) => ({
          id: a.id,
          name: a.name,
          externalId: a.externalId,
          currency: a.currency,
          status: a.status,
          statusMessage: a.statusMessage,
          lastSynced: a.lastSyncedAt ? timeAgo(a.lastSyncedAt) : null,
          clients: a.clientSources.map((s) => s.client),
        })),
      };
    })
    // Riktiga inloggningar först, sedan plattform, sedan demodata.
    .sort((a, b) => Number(a.isMock) - Number(b.isMock) || PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));

  const all = views.flatMap((v) => v.accounts);
  const used = all.filter((a) => a.clients.length > 0);
  const broken = used.filter((a) => a.status === "AUTH_REQUIRED" || a.status === "SYNC_ERROR");

  const connectors: ConnectorOption[] = listConnectors()
    .filter((c) => showMock || !c.isMock)
    .map((c) => ({
      id: c.id,
      platform: c.platform as PlatformId,
      label: PLATFORMS[c.platform as PlatformId].label,
      isMock: !!c.isMock,
      configured: c.isConfigured?.() ?? true,
      token: c.auth.type === "token" ? { tokenLabel: c.auth.tokenLabel, help: c.auth.help, helpUrl: c.auth.helpUrl, scopes: c.auth.scopes } : null,
      via: c.auth.type === "token" ? "med token" : `via ${c.platform === "ga4" || c.platform === "google_ads" ? "Google" : c.label}`,
    }));

  // Direktlänk till token-inklistring (t.ex. "Koppla om" för Meta).
  const openToken = typeof sp.connector === "string" ? connectors.find((c) => c.id === sp.connector && c.token) : undefined;
  const reconnect = typeof sp.reconnect === "string" ? sp.reconnect : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Suspense>
        <OAuthToast />
      </Suspense>
      <PageHeader
        title="Databaser"
        description="Byråns inloggningar mot plattformarna och alla konton de ger åtkomst till. Kunderna väljer sina källor härifrån; bara valda källor hämtar data."
      >
        {isAdmin && <ConnectDialog connectors={connectors} defaultOpen={sp.koppla === "1"} />}
      </PageHeader>

      {sp.error === "not_configured" && (
        <p role="alert" className="mb-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-destructive">
          Kopplingen är inte aktiverad – appens API-nycklar saknas (se docs/API-GODKANNANDEN.md).
        </p>
      )}
      {isAdmin && openToken?.token && (
        <div className="hidden">
          <TokenDialog connectorId={openToken.id} label={openToken.label} {...openToken.token} defaultOpen reconnectConnectionId={reconnect} />
        </div>
      )}

      <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Inloggningar" value={views.length} />
        <Stat label="Konton" value={all.length} />
        <Stat label="Används av kunder" value={used.length} />
        <Stat label="Behöver åtgärd" value={broken.length} warning={broken.length > 0} />
      </dl>

      {views.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <p className="font-medium">Inga inloggningar än</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {isAdmin ? "Koppla byråns Google-konto, Meta-systemanvändare, LinkedIn eller TikTok. Alla konton de har åtkomst till dyker upp här." : "En administratör kopplar byråns inloggningar här."}
          </p>
          {isAdmin && (
            <div className="mt-5">
              <ConnectDialog connectors={connectors} />
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-5">
          {views.map((v) => (
            <li key={v.id}>
              <ConnectionCard connection={v} isAdmin={isAdmin} highlight={sp.connection === v.id} reconnectToken={connectors.find((c) => c.id === v.connectorId)?.token ?? null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className="flex flex-col-reverse rounded-xl border bg-card p-3 shadow-soft sm:p-5">
      <dt className="mt-2 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase sm:text-xs">{label}</dt>
      <dd className={warning ? "tabular text-3xl leading-none font-bold text-warning sm:text-[40px]" : "tabular text-3xl leading-none font-bold text-heading sm:text-[40px]"}>{value}</dd>
    </div>
  );
}
