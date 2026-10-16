import { describeSchedule, RANGE_PRESETS } from "@rp/core";
import { Inbox, Mail } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/dal";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorText } from "@/components/error-text";
import { ScheduleToggle } from "./schedule-toggle";

export const metadata = { title: "Utskick" };

const when = new Intl.DateTimeFormat("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ReportsPage() {
  const ctx = await requireWorkspace();
  const { schedules, deliveries } = await ctx.tx(async (tx) => ({
    schedules: await tx.reportSchedule.findMany({
      orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
      include: { dashboard: { select: { id: true, name: true, client: { select: { name: true, slug: true } } } } },
    }),
    deliveries: await tx.reportDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  }));
  const dashboards = await ctx.tx((tx) =>
    tx.dashboard.findMany({ where: { id: { in: [...new Set(deliveries.map((d) => d.dashboardId))] } }, select: { id: true, name: true, client: { select: { name: true } } } }),
  );
  const dashById = new Map(dashboards.map((d) => [d.id, d]));
  const usesOutbox = !process.env.RESEND_API_KEY;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <PageHeader title="Utskick" description="Schemalagda PDF-rapporter till kunder och historik över skickade mejl." />

      {usesOutbox && (
        <p className="mb-6 flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-soft">
          <Inbox className="mt-0.5 size-4 shrink-0" />
          Mejl skickas inte än: ingen e-posttjänst är kopplad. Rapporterna sparas i utkorgen nedan så att du kan se exakt vad kunden skulle få. Be den som sköter appens drift att koppla e-postutskick.
        </p>
      )}

      <section aria-labelledby="sch-heading" className="space-y-3">
        <h2 id="sch-heading" className="text-xl font-bold tracking-tight text-heading">
          Schemalagda <span className="tabular text-muted-foreground">{schedules.length}</span>
        </h2>
        {schedules.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground">
            Inga schemalagda utskick. Öppna en dashboard och välj &quot;Schemalagda utskick&quot; i menyn.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
            {schedules.map((s) => (
              <li key={s.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5", !s.active && "opacity-60")}>
                <Mail className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <Link href={`/clients/${s.dashboard.client.slug}/dashboards/${s.dashboard.id}`} className="font-medium hover:underline">
                    {s.dashboard.client.name} · {s.dashboard.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {describeSchedule(s)} · {RANGE_PRESETS.find((r) => r.id === s.rangePreset)?.label.toLowerCase()} · {s.recipients.join(", ")}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">{s.active ? `Nästa ${when.format(s.nextRunAt)}` : "Pausad"}</span>
                {ctx.can("EDITOR") && <ScheduleToggle id={s.id} active={s.active} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="del-heading" className="mt-10 space-y-3">
        <h2 id="del-heading" className="text-xl font-bold tracking-tight text-heading">
          Senaste utskick
        </h2>
        {deliveries.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card/50 px-6 py-8 text-center text-sm text-muted-foreground">Inget har skickats än.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Rapport</th>
                  <th className="px-3 py-2.5 text-left font-medium">Mottagare</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium">Skickat</th>
                  <th className="px-5 py-2.5 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliveries.map((d) => {
                  const dash = dashById.get(d.dashboardId);
                  return (
                    <tr key={d.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{dash ? `${dash.client.name} · ${dash.name}` : d.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.rangeLabel}
                          {d.pageCount ? ` · ${d.pageCount} sidor` : ""}
                          {d.scheduleId ? " · schemalagt" : " · manuellt"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{d.recipients.join(", ")}</td>
                      <td className="px-3 py-3">
                        {d.status === "SENT" ? (
                          d.provider === "outbox" ? (
                            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning" title="Sparat i utkorgen – inte skickat till mottagarna">
                              Ej skickat
                            </span>
                          ) : (
                            <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Skickat</span>
                          )
                        ) : (
                          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-destructive">
                            Misslyckades
                          </span>
                        )}
                        <ErrorText error={d.error} className="mt-1 max-w-xs" />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{timeAgo(d.createdAt)}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {d.htmlPath && (
                          <a className="mr-3 font-medium hover:underline" href={`/api/deliveries/${d.id}/html`} target="_blank" rel="noreferrer">
                            Mejl
                          </a>
                        )}
                        {d.pdfPath && (
                          <a className="font-medium hover:underline" href={`/api/deliveries/${d.id}/pdf`} target="_blank" rel="noreferrer">
                            PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
