"use client";

import { formatDelta, formatMetric, METRICS, type DataFilter, type Delta, type MetricId, type PlatformId } from "@rp/core";
import type { AccountStatus } from "@rp/db";
import { Filter, Loader2, MoreHorizontal, RefreshCw, Unplug, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Catalog } from "@/lib/availability";
import { cn } from "@/lib/utils";
import { removeClientSource, syncAccountNow } from "../actions";
import { SourceFilterDialog } from "./source-filter-dialog";

export interface AccountHeadline {
  metric: MetricId;
  value: number | null;
  delta: Delta;
}

interface Props {
  account: {
    id: string;
    name: string;
    platform: string;
    connectorId: string;
    externalId: string;
    currency: string;
    status: AccountStatus;
    statusMessage: string | null;
    lastSynced: string;
    headline: AccountHeadline[];
    /** Kundens filter för källan */
    filters: DataFilter[];
    filterLabels: string[];
    /** Andra kunder som använder samma källa */
    sharedWith: string[];
  };
  platformLabel: string;
  clientCurrency: string;
  clientId: string;
  canEdit: boolean;
  isAdmin: boolean;
  catalog: Catalog;
}

export function AccountRow({ account: a, platformLabel, clientCurrency, clientId, canEdit, isAdmin, catalog }: Props) {
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const sync = () =>
    start(async () => {
      const res = await syncAccountNow(a.id);
      if (res.ok) toast.success(res.message ?? "Synkat");
      else toast.error(res.error);
    });

  const remove = () =>
    start(async () => {
      const res = await removeClientSource(clientId, a.id);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });

  return (
    <li className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <PlatformIcon platform={a.platform} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-medium">{a.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {platformLabel} · {a.externalId}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status} />
            {a.currency !== clientCurrency && (
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground" title="Räknas om till kundens rapportvaluta (fas 3)">
                {a.currency} → {clientCurrency}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{a.status === "PENDING" && a.lastSynced === "aldrig" ? "Hämtar data …" : `Synkad ${a.lastSynced}`}</span>
          </div>
          {a.filterLabels.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="Kundens filter för källan">
              {a.filterLabels.map((f) => (
                <li key={f} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                  <Filter className="size-3" aria-hidden /> {f}
                </li>
              ))}
            </ul>
          )}
          {a.sharedWith.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" aria-hidden /> Används även av {a.sharedWith.join(", ")}
            </p>
          )}
          {a.statusMessage && a.status !== "OK" && <p className="mt-1.5 text-xs text-muted-foreground">{a.statusMessage}</p>}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-4">
        {a.headline.map((h) => (
          <div key={h.metric} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{METRICS[h.metric].shortLabel ?? METRICS[h.metric].label}</dt>
            <dd className="tabular truncate text-base font-semibold">{formatMetric(h.metric, h.value, a.currency)}</dd>
            <dd>
              <DeltaText metric={h.metric} delta={h.delta} />
            </dd>
          </div>
        ))}
      </dl>

      {canEdit && (
        <div className="flex items-center gap-2 lg:justify-end">
          {a.status === "AUTH_REQUIRED" ? (
            isAdmin ? (
              <Button size="sm" asChild>
                <Link href="/databases">Koppla om i Databaser</Link>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">En administratör behöver koppla om inloggningen.</span>
            )
          ) : (
            <Button size="sm" variant="outline" onClick={sync} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Synka nu
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={`Fler val för ${a.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilterOpen(true)}>
                <Filter /> Filter för kunden{a.filters.length ? ` (${a.filters.length})` : ""}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                <Unplug /> Ta bort från kunden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort {a.name} från kunden?</AlertDialogTitle>
            <AlertDialogDescription>
              Kundens widgets slutar använda källan. Källan och dess data finns kvar i Databaser{a.sharedWith.length ? ` och hos ${a.sharedWith.join(", ")}` : ""}, och kan väljas igen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">
              Ta bort från kunden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {canEdit && (
        <SourceFilterDialog
          open={filterOpen}
          onOpenChange={setFilterOpen}
          clientId={clientId}
          accountId={a.id}
          accountName={a.name}
          platform={a.platform as PlatformId}
          filters={a.filters}
          catalog={catalog}
        />
      )}
    </li>
  );
}

export function DeltaText({ metric, delta }: { metric: MetricId; delta: Delta }) {
  const label = formatDelta(metric, delta);
  const tone = delta.kind === "change" ? (delta.favorable === null ? "text-foreground/70" : delta.favorable ? "text-success" : "text-destructive") : delta.kind === "new" ? "text-link" : "text-muted-foreground";
  const arrow = delta.kind === "change" ? (delta.absolute > 0 ? "↑" : "↓") : "";
  return (
    <span className={cn("tabular text-xs font-medium", tone)}>
      {arrow && <span aria-hidden>{arrow} </span>}
      {label}
    </span>
  );
}
