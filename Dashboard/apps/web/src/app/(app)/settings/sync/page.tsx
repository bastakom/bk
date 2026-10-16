import { formatRange, PLATFORMS, type PlatformId } from "@rp/core";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PlatformIcon } from "@/components/platform-icon";
import { requireWorkspace } from "@/lib/dal";
import { timeAgo } from "@/lib/format";
import { ErrorText } from "@/components/error-text";
import { SettingsNav } from "../settings-nav";

export const metadata = { title: "Synk och larm" };


export default async function SyncLogPage() {
  const ctx = await requireWorkspace();
  const { alerts, runs, accounts } = await ctx.tx(async (tx) => ({
    alerts: await tx.syncAlert.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "desc" },
      include: { account: { select: { name: true, platform: true, clientSources: { select: { client: { select: { name: true, slug: true } } } } } } },
    }),
    runs: await tx.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 40,
      include: { account: { select: { name: true, platform: true, clientSources: { select: { client: { select: { name: true, slug: true } } } } } } },
    }),
    // Bara källor som någon kund använder synkas.
    accounts: await tx.connectedAccount.groupBy({ by: ["status"], where: { clientSources: { some: {} } }, _count: true }),
  }));
  const interval = Number(process.env.SYNC_INTERVAL_HOURS ?? 4);
  const total = accounts.reduce((s, a) => s + a._count, 0);
  const ok = accounts.find((a) => a.status === "OK")?._count ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <PageHeader title="Inställningar" description={ctx.workspace.name} />
      <SettingsNav />

      <p className="mb-6 text-sm text-muted-foreground">
        Alla kopplade konton synkas automatiskt var {interval}:e timme (senaste {process.env.SYNC_LOOKBACK_DAYS ?? 7} dagarna uppdateras, eftersom plattformarna
        justerar siffror i efterhand). Vid fel försöker workern igen med backoff; tappad behörighet larmas en gång till byråns admins.{" "}
        <span className="tabular font-medium text-foreground">
          {ok} av {total}
        </span>{" "}
        konton fungerar.
      </p>

      <section aria-labelledby="alerts-heading" className="space-y-3">
        <h2 id="alerts-heading" className="text-xl font-bold tracking-tight text-heading">
          Öppna larm <span className="tabular text-muted-foreground">{alerts.length}</span>
        </h2>
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border bg-card px-5 py-4 text-sm shadow-soft">
            <CheckCircle2 className="size-4 text-success" /> Alla kopplingar fungerar.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <Link href="/databases" className="hover:underline">
                      {a.account.name}
                    </Link>
                    {a.account.clientSources.length > 0 && <span className="font-normal text-muted-foreground"> · {a.account.clientSources.map((c) => c.client.name).join(", ")}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {a.kind === "AUTH_REQUIRED" ? "Behörighet saknas" : "Synkfel"}: <ErrorText error={a.message} className="inline" />
                  </p>
                </div>
                <span className="text-right text-xs whitespace-nowrap text-muted-foreground">
                  {timeAgo(a.createdAt)}
                  <br />
                  {a.notifiedAt ? "Mejlat till admins" : "Ej mejlat"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="runs-heading" className="mt-10 space-y-3">
        <h2 id="runs-heading" className="text-xl font-bold tracking-tight text-heading">
          Senaste synkar
        </h2>
        <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Konto</th>
                <th className="px-3 py-2.5 text-left font-medium">Period</th>
                <th className="px-3 py-2.5 text-right font-medium">Rader</th>
                <th className="px-3 py-2.5 text-right font-medium">Tid</th>
                <th className="px-5 py-2.5 text-left font-medium">Resultat</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2">
                      <PlatformIcon platform={r.account.platform} size="sm" />
                      <span>
                        <span className="block">{r.account.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.account.clientSources.map((c) => c.client.name).join(", ") || "Ingen kund"} · {PLATFORMS[r.account.platform as PlatformId]?.label}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatRange({ start: r.rangeStart.toISOString().slice(0, 10), end: r.rangeEnd.toISOString().slice(0, 10) })}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{r.rowsWritten.toLocaleString("sv-SE")}</td>
                  <td className="tabular px-3 py-2.5 text-right whitespace-nowrap text-muted-foreground">
                    {r.finishedAt ? `${((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} s` : "pågår"}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="flex items-start gap-1.5">
                      {r.status === "SUCCESS" ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> : r.status === "FAILED" ? <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" /> : null}
                      <span>
                        {r.status === "SUCCESS" ? "Lyckades" : r.status === "FAILED" ? "Misslyckades" : "Pågår"} · {timeAgo(r.startedAt)}
                        <ErrorText error={r.error} />
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
