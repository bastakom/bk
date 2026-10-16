"use client";

import { PLATFORMS, type PlatformId } from "@rp/core";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyDefinition } from "./actions";

interface Slot {
  key: string;
  platform: PlatformId;
  label: string;
  widgets: number;
}
interface ClientOpt {
  id: string;
  name: string;
  slug: string;
  accounts: { id: string; name: string; platform: PlatformId; currency: string }[];
}

const SKIP = "__skip";

/** Förvalt: första lediga konto med rätt plattform för varje slot, i ordning. */
function autoMapping(slots: Slot[], client: ClientOpt | undefined): Record<string, string> {
  const used = new Set<string>();
  const out: Record<string, string> = {};
  for (const s of slots) {
    const acc = client?.accounts.find((a) => a.platform === s.platform && !used.has(a.id));
    if (acc) used.add(acc.id);
    out[s.key] = acc?.id ?? SKIP;
  }
  return out;
}

export function MappingForm(props: {
  source: { kind: "template" | "dashboard"; id: string };
  defaultName: string;
  slots: Slot[];
  widgetCount: number;
  clients: ClientOpt[];
  initialClient?: string;
}) {
  const [clientId, setClientId] = useState(props.initialClient ?? "");
  const client = props.clients.find((c) => c.id === clientId);
  const [mapping, setMapping] = useState<Record<string, string>>(() => autoMapping(props.slots, client));
  const [name, setName] = useState(props.defaultName);
  const [pending, start] = useTransition();

  const mapped = useMemo(() => props.slots.filter((s) => mapping[s.key] && mapping[s.key] !== SKIP).length, [props.slots, mapping]);

  const submit = () =>
    start(async () => {
      const res = await applyDefinition({
        source: props.source,
        clientId,
        name,
        mapping: Object.fromEntries(Object.entries(mapping).map(([k, v]) => [k, v === SKIP ? null : v])),
      });
      if (res && !res.ok) toast.error(res.error);
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-card p-5 shadow-soft sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Kund</Label>
          <Select
            value={clientId}
            onValueChange={(v) => {
              setClientId(v);
              setMapping(autoMapping(props.slots, props.clients.find((c) => c.id === v)));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Välj kund" />
            </SelectTrigger>
            <SelectContent>
              {props.clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-name">Dashboardens namn</Label>
          <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      {client && (
        <section aria-labelledby="slots-heading" className="overflow-hidden rounded-xl border bg-card shadow-soft">
          <div className="flex items-baseline justify-between border-b px-5 py-3">
            <h2 id="slots-heading" className="font-medium">
              Källor
            </h2>
            <p className="text-sm text-muted-foreground">
              {mapped} av {props.slots.length} mappade · {props.widgetCount} widgets
            </p>
          </div>
          {props.slots.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Mallen har inga datakällor.</p>
          ) : (
            <ul className="divide-y">
              {props.slots.map((s) => {
                const options = client.accounts.filter((a) => a.platform === s.platform);
                return (
                  <li key={s.key} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)]">
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={s.platform} />
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">Används i {s.widgets} widgets</p>
                      </div>
                    </div>
                    <ArrowRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
                    {options.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {client.name} har inget {PLATFORMS[s.platform].label}-konto.{" "}
                        <Link className="font-medium text-foreground underline underline-offset-2" href={`/clients/${client.slug}`}>
                          Välj en källa
                        </Link>
                      </p>
                    ) : (
                      <Select value={mapping[s.key] ?? SKIP} onValueChange={(v) => setMapping((m) => ({ ...m, [s.key]: v }))}>
                        <SelectTrigger className="w-full" aria-label={`Konto för ${s.label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name} <span className="text-muted-foreground">· {a.currency}</span>
                            </SelectItem>
                          ))}
                          <SelectItem value={SKIP}>Hoppa över</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={!client || !name.trim() || pending}>
          {pending && <Loader2 className="animate-spin" />}
          Skapa dashboard
        </Button>
      </div>
    </div>
  );
}
