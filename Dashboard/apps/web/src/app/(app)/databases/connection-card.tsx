"use client";

import type { PlatformId } from "@rp/core";
import type { AccountStatus, ConnectionStatus } from "@rp/db";
import { KeyRound, Loader2, MoreHorizontal, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { refreshConnection, removeConnection } from "./actions";
import { TokenDialog } from "./token-dialog";

export interface ConnectionView {
  id: string;
  connectorId: string;
  platform: PlatformId;
  platformLabel: string;
  label: string;
  isMock: boolean;
  authType: "oauth2" | "token";
  status: ConnectionStatus;
  createdAgo: string;
  accounts: {
    id: string;
    name: string;
    externalId: string;
    currency: string;
    status: AccountStatus;
    statusMessage: string | null;
    lastSynced: string | null;
    clients: { name: string; slug: string }[];
  }[];
}

const COLLAPSED = 8;

export function ConnectionCard({
  connection: c,
  isAdmin,
  highlight,
  reconnectToken,
}: {
  connection: ConnectionView;
  isAdmin: boolean;
  highlight?: boolean;
  reconnectToken: { tokenLabel: string; help: string; helpUrl?: string; scopes: string[] } | null;
}) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const used = c.accounts.filter((a) => a.clients.length > 0);
  const affected = [...new Set(used.flatMap((a) => a.clients.map((x) => x.name)))];
  const revoked = c.status !== "ACTIVE";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? c.accounts.filter((a) => a.name.toLowerCase().includes(q) || a.externalId.toLowerCase().includes(q) || a.clients.some((x) => x.name.toLowerCase().includes(q))) : c.accounts;
    // Använda konton först.
    return [...list].sort((a, b) => Number(b.clients.length > 0) - Number(a.clients.length > 0));
  }, [c.accounts, query]);
  const shown = expanded || query ? filtered : filtered.slice(0, COLLAPSED);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message ?? "Klart");
      else toast.error(res.error);
    });

  return (
    <article
      aria-label={`${c.platformLabel} – ${c.label}`}
      className={cn("overflow-hidden rounded-xl border bg-card shadow-soft", highlight && "ring-2 ring-primary/60")}
    >
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <PlatformIcon platform={c.platform} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {c.platformLabel}
            {c.isMock && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Demodata</span>}
            {revoked && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-destructive">Behöver kopplas om</span>}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {c.label} · kopplad {c.createdAgo} · {c.accounts.length} konton, {used.length} används
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1">
            {revoked ? (
              <ReconnectButton connection={c} token={reconnectToken} />
            ) : (
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => refreshConnection(c.id))}>
                {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Uppdatera kontolista
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Fler val för ${c.label}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!revoked && c.authType === "oauth2" && (
                  <DropdownMenuItem asChild>
                    <a href={`/api/connect/${c.connectorId}/start?reconnect=${c.id}`}>
                      <KeyRound /> Koppla om
                    </a>
                  </DropdownMenuItem>
                )}
                {!revoked && c.authType === "token" && (
                  <DropdownMenuItem asChild>
                    <Link href={`/databases?connector=${c.connectorId}&reconnect=${c.id}`}>
                      <KeyRound /> Byt token
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirm(true)}>
                  <Trash2 /> Ta bort inloggning
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      {c.accounts.length > COLLAPSED && (
        <div className="relative border-b px-5 py-2.5">
          <Search className="pointer-events-none absolute top-1/2 left-7.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök konto, id eller kund …" className="h-8 pl-8" aria-label={`Sök bland kontona i ${c.label}`} />
        </div>
      )}

      {c.accounts.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Inloggningen ger inte åtkomst till några konton. Kontrollera behörigheterna hos plattformen och uppdatera kontolistan.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="sr-only sm:not-sr-only">
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-2 font-medium">Konto</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Status</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">Senast synkad</th>
              <th className="px-5 py-2 font-medium">Används av</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((a) => (
              <tr key={a.id} className={a.clients.length ? undefined : "text-muted-foreground"}>
                <td className="px-5 py-2.5">
                  <p className={cn("font-medium", !a.clients.length && "font-normal")}>{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.externalId} · {a.currency}
                  </p>
                </td>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  {a.clients.length ? <StatusBadge status={a.status} /> : <span className="text-xs">Ingen kund – synkas inte</span>}
                  {a.clients.length > 0 && a.statusMessage && a.status !== "OK" && <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground" title={a.statusMessage}>{a.statusMessage}</p>}
                </td>
                <td className="hidden px-3 py-2.5 text-xs lg:table-cell">{a.lastSynced ?? "–"}</td>
                <td className="px-5 py-2.5">
                  {a.clients.length ? (
                    <ul className="flex flex-wrap gap-1">
                      {a.clients.map((x) => (
                        <li key={x.slug}>
                          <Link href={`/clients/${x.slug}`} className="inline-block rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground hover:underline">
                            {x.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!query && filtered.length > COLLAPSED && (
        <div className="border-t px-5 py-2">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Visa färre" : `Visa alla ${filtered.length} konton`}
          </Button>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort {c.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Alla {c.accounts.length} konton under inloggningen tas bort ur Databaser och deras synkade data raderas.
              {affected.length > 0 && ` Kunder som använder dem: ${affected.join(", ")}. Deras widgets slutar visa data från kontona.`} Detta går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(() => removeConnection(c.id))} className="bg-destructive text-white hover:bg-destructive/90">
              Ta bort och radera data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function ReconnectButton({ connection: c, token }: { connection: ConnectionView; token: { tokenLabel: string; help: string; helpUrl?: string; scopes: string[] } | null }) {
  if (token) return <TokenDialog connectorId={c.connectorId} label={c.platformLabel} {...token} reconnectConnectionId={c.id} trigger={<Button size="sm">Koppla om</Button>} />;
  return (
    <Button size="sm" asChild>
      <a href={`/api/connect/${c.connectorId}/start?reconnect=${c.id}`}>Koppla om</a>
    </Button>
  );
}
