"use client";

import type { PlatformId } from "@rp/core";
import { Plus } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TokenDialog } from "./token-dialog";

export interface ConnectorOption {
  id: string;
  platform: PlatformId;
  label: string;
  isMock: boolean;
  configured: boolean;
  via: string;
  token: { tokenLabel: string; help: string; helpUrl?: string; scopes: string[] } | null;
}

/** Koppla en ny inloggning: OAuth via plattformen, inklistrad token (Meta) eller demodata. */
/** `defaultOpen`: öppnas direkt, t.ex. från kommandopaletten (/databases?koppla=1). */
export function ConnectDialog({ connectors, defaultOpen = false }: { connectors: ConnectorOption[]; defaultOpen?: boolean }) {
  const groups = [
    { title: "Riktiga kopplingar", text: "Logga in hos plattformen. Vi begär bara läsrättigheter.", list: connectors.filter((c) => !c.isMock) },
    { title: "Demodata", text: "Simulerade konton med realistisk data – för demo och test.", list: connectors.filter((c) => c.isMock) },
  ].filter((g) => g.list.length);

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Koppla ny inloggning
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Koppla ny inloggning</DialogTitle>
          <DialogDescription>Alla konton som inloggningen har åtkomst till läses in i Databaser. Ingen data hämtas förrän en kund väljer kontot.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-6 overflow-y-auto pr-1">
          {groups.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h3 className="text-sm font-medium">{g.title}</h3>
              <p className="mb-3 text-xs text-muted-foreground">{g.text}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {g.list.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <PlatformIcon platform={c.platform} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.isMock ? "Demodata" : c.configured ? `Riktig koppling ${c.via}` : "Inte aktiverad – API-nycklar saknas"}</p>
                    </div>
                    {c.configured &&
                      (c.token ? (
                        <TokenDialog connectorId={c.id} label={c.label} {...c.token} trigger={<Button size="sm">Koppla</Button>} />
                      ) : (
                        <Button size="sm" asChild>
                          <a href={`/api/connect/${c.id}/start`} aria-label={`Koppla ${c.label}${c.isMock ? " (demodata)" : ""}`}>
                            Koppla
                          </a>
                        </Button>
                      ))}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
