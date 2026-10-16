"use client";

import { CalendarClock, LayoutDashboard, LayoutGrid, Link2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initials, timeAgo } from "@/lib/format";

interface Row {
  id: string;
  name: string;
  updatedAt: string;
  inPortal: boolean;
  widgets: number;
  shared: number;
  scheduled: number;
  client: { id: string; name: string; slug: string; primaryColor: string; logoUrl: string | null };
}

const ALL = "__all__";

export function DashboardsList({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [client, setClient] = useState(ALL);
  const [sort, setSort] = useState<"updated" | "name" | "client">("updated");
  const clients = useMemo(() => [...new Map(rows.map((r) => [r.client.id, r.client])).values()].sort((a, b) => a.name.localeCompare(b.name, "sv")), [rows]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => (client === ALL || r.client.id === client) && (!needle || `${r.name} ${r.client.name}`.toLowerCase().includes(needle)));
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    if (sort === "client") out.sort((a, b) => a.client.name.localeCompare(b.client.name, "sv") || a.name.localeCompare(b.name, "sv"));
    return out;
  }, [rows, q, client, sort]);

  if (!rows.length)
    return <EmptyState icon={<LayoutDashboard />} title="Inga dashboards än" text="Öppna en kund och skapa en dashboard, tom eller från en av byråns mallar." action={<Link href="/clients" className="font-semibold text-link underline-offset-2 hover:underline">Till kunderna</Link>} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök dashboard eller kund …" aria-label="Sök dashboard eller kund" className="h-10 pl-9" />
        </div>
        <Select value={client} onValueChange={setClient}>
          <SelectTrigger className="h-10 w-48" aria-label="Kund">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alla kunder</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-10 w-48" aria-label="Sortering">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Senast ändrade</SelectItem>
            <SelectItem value="name">Namn A–Ö</SelectItem>
            <SelectItem value="client">Kund A–Ö</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
          {list.length} av {rows.length}
        </p>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Search />} title="Inga träffar" text={`Ingen dashboard matchar ”${q}”.`} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => (
            <li key={d.id}>
              <Link
                href={`/clients/${d.client.slug}/dashboards/${d.id}`}
                className="group flex h-full flex-col rounded-xl bg-card p-5 shadow-soft ring-1 ring-border transition-all outline-none hover:-translate-y-0.5 hover:ring-heading/30 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  {d.client.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.client.logoUrl} alt="" className="h-5 max-w-16 object-contain" />
                  ) : (
                    <span className="grid size-5 place-items-center rounded-md text-[9px] font-bold text-white" style={{ background: d.client.primaryColor }} aria-hidden>
                      {initials(d.client.name)}
                    </span>
                  )}
                  {d.client.name}
                </span>
                <span className="mt-3 text-h3 font-bold tracking-tight text-heading">{d.name}</span>
                <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-5 text-xs text-muted-foreground">
                  <span>{d.widgets} widgets</span>
                  <span>Ändrad {timeAgo(new Date(d.updatedAt))}</span>
                  {d.shared > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Link2 className="size-3" aria-hidden /> Delad
                    </span>
                  )}
                  {d.scheduled > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" aria-hidden /> Schemalagd
                    </span>
                  )}
                  {d.inPortal && (
                    <span className="inline-flex items-center gap-1">
                      <LayoutGrid className="size-3" aria-hidden /> I portalen
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
