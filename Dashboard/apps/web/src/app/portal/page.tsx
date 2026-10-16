import { t } from "@rp/core";
import { ArrowRight, FileBarChart } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { brandScope } from "@/lib/brand";
import { requirePortal } from "@/lib/dal";
import { initials } from "@/lib/format";
import { portalDashboards, portalLang, workspaceBrand } from "./data";

/** Kundens startsida: alla rapporter som byrån visar i portalen. En enda rapport öppnas direkt. */
export default async function PortalPage() {
  const ctx = await requirePortal();
  const [dashboards, ws] = await Promise.all([portalDashboards(ctx), workspaceBrand(ctx.workspace.id)]);
  if (dashboards.length === 1 && ctx.role === "CLIENT") redirect(`/portal/${dashboards[0]!.id}`);
  const lang = portalLang(dashboards.map((d) => d.client.locale));
  const en = lang === "en";
  const byClient = Map.groupBy(dashboards, (d) => d.client.id);

  return (
    <div className="brand-scope" {...brandScope(ws.brandColor, ws.fontFamily)}>
      <main className="mx-auto max-w-4xl px-4 py-10 md:px-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-h1 font-bold tracking-tight text-heading">{en ? "Your reports" : "Era rapporter"}</h1>
            <p className="text-sm text-muted-foreground">{en ? `Live reports from ${ws.name}, always up to date.` : `Live-rapporter från ${ws.name}, alltid med aktuella siffror.`}</p>
          </div>
          {ws.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ws.logoUrl} alt={ws.name} className="h-8 max-w-40 object-contain" />
          )}
        </header>
        {dashboards.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {ctx.role === "CLIENT"
              ? en
                ? `No reports yet. ${ws.name} will publish them here.`
                : `Inga rapporter än. ${ws.name} publicerar dem här.`
              : "Inga rapporter visas i kundportalen än. Slå på ”Visa i kundportalen” under Dela på en dashboard."}
          </p>
        ) : (
          <div className="space-y-8">
            {[...byClient.values()].map((list) => {
              const client = list[0]!.client;
              return (
                <section key={client.id} aria-label={client.name}>
                  {byClient.size > 1 && (
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-medium tracking-wide uppercase">
                      {client.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={client.logoUrl} alt="" className="h-5 max-w-20 object-contain" />
                      ) : (
                        <span className="grid size-5 place-items-center rounded text-[9px] font-semibold text-white" style={{ background: client.primaryColor }}>
                          {initials(client.name)}
                        </span>
                      )}
                      {client.name}
                    </h2>
                  )}
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {list.map((d) => (
                      <li key={d.id}>
                        <Link href={`/portal/${d.id}`} className="group flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-soft transition-colors hover:border-foreground/20">
                          <FileBarChart className="mt-0.5 size-5 shrink-0 text-highlight" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{d.name}</span>
                            {d.description && <span className="mt-0.5 block text-sm text-muted-foreground">{d.description}</span>}
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {t(lang, "updated")} {new Intl.DateTimeFormat(en ? "en-GB" : "sv-SE", { day: "numeric", month: "short" }).format(d.updatedAt)}
                            </span>
                          </span>
                          <ArrowRight className="size-4 shrink-0 self-center opacity-40 transition-opacity group-hover:opacity-100" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
