"use client";

import type { Role } from "@rp/db";
import { Check, ChevronsUpDown, Loader2, Mail, UserMinus, UserPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { changeRole, inviteMember, removeMember, revokeInvitation, setMemberClients } from "./actions";

export const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "ADMIN", label: "Admin", hint: "Allt, inklusive team, källor och att radera kunder. Ser alltid alla kunder." },
  { value: "EDITOR", label: "Redaktör", hint: "Bygger rapporter, mål och larm för sina kunder." },
  { value: "VIEWER", label: "Läsare", hint: "Ser sina kunder och rapporter men ändrar inget." },
  { value: "CLIENT", label: "Kund", hint: "Kundens egen inloggning: ser bara rapporter som visas i kundportalen." },
];

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  clientIds: string[];
}
interface Invitation {
  id: string;
  email: string;
  role: Role;
  clientIds: string[];
  expiresAt: string;
}
type ClientOption = { id: string; name: string };

type Result = { ok: true; message?: string } | { ok: false; error: string };
const report = (res: Result) => {
  if (res.ok) toast.success(res.message);
  else toast.error(res.error);
};

export function MembersTable({ members, invitations, clients, canManage, currentUserId }: { members: Member[]; invitations: Invitation[]; clients: ClientOption[]; canManage: boolean; currentUserId: string }) {
  const [, start] = useTransition();
  const clientLabel = (role: Role, ids: string[]) =>
    role === "ADMIN" ? "Alla kunder" : ids.length ? (ids.length === 1 ? (clients.find((c) => c.id === ids[0])?.name ?? "1 kund") : `${ids.length} kunder`) : role === "CLIENT" ? "Inga kunder" : "Alla kunder";

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <ul className="divide-y" aria-label="Medlemmar">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name} {m.userId === currentUserId && <span className="text-muted-foreground">(du)</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
            </div>
            {canManage && m.userId !== currentUserId ? (
              <>
                {m.role !== "ADMIN" && (
                  <ClientPicker
                    clients={clients}
                    value={m.clientIds}
                    label={clientLabel(m.role, m.clientIds)}
                    allLabel={m.role === "CLIENT" ? null : "Alla kunder"}
                    ariaLabel={`Kunder för ${m.name}`}
                    onCommit={(ids) => start(async () => report(await setMemberClients(m.id, ids)))}
                  />
                )}
                <Select value={m.role} onValueChange={(v) => start(async () => report(await changeRole(m.id, v)))}>
                  <SelectTrigger className="w-32" aria-label={`Roll för ${m.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" aria-label={`Ta bort ${m.name}`} onClick={() => start(async () => report(await removeMember(m.id)))}>
                  <UserMinus />
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                {ROLES.find((r) => r.value === m.role)?.label} · {clientLabel(m.role, m.clientIds)}
              </span>
            )}
          </li>
        ))}
        {invitations.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 bg-muted/20 px-5 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
              <Mail className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                Inbjuden · {ROLES.find((r) => r.value === i.role)?.label} · {clientLabel(i.role, i.clientIds)}
              </p>
            </div>
            {canManage && (
              <Button variant="ghost" size="sm" onClick={() => start(async () => report(await revokeInvitation(i.id)))}>
                <X /> Återkalla
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <div className="border-t bg-muted/30 px-5 py-3">
          <InviteDialog clients={clients} />
        </div>
      )}
    </div>
  );
}

function InviteDialog({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState({ email: "", name: "", role: "EDITOR" as Role, clientIds: [] as string[] });
  const role = ROLES.find((r) => r.value === v.role)!;
  const submit = () =>
    start(async () => {
      const res = await inviteMember(v);
      report(res);
      if (res.ok) {
        setOpen(false);
        setV({ email: "", name: "", role: "EDITOR", clientIds: [] });
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus /> Bjud in
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bjud in</DialogTitle>
          <DialogDescription>Personen får ett mejl med en länk där hen väljer lösenord. Länken gäller i 14 dagar.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">E-post</Label>
            <Input id="inv-email" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="namn@foretag.se" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Namn (valfritt)</Label>
            <Input id="inv-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-role">Roll</Label>
            <Select value={v.role} onValueChange={(r) => setV({ ...v, role: r as Role })}>
              <SelectTrigger id="inv-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{role.hint}</p>
          </div>
          {v.role !== "ADMIN" && (
            <div className="space-y-1.5">
              <Label>Kunder</Label>
              <ClientPicker
                clients={clients}
                value={v.clientIds}
                label={v.clientIds.length ? `${v.clientIds.length} ${v.clientIds.length === 1 ? "kund" : "kunder"}` : v.role === "CLIENT" ? "Välj kunder …" : "Alla kunder"}
                allLabel={v.role === "CLIENT" ? null : "Alla kunder"}
                ariaLabel="Kunder"
                onCommit={(clientIds) => setV({ ...v, clientIds })}
                live
                wide
              />
              <p className="text-xs text-muted-foreground">{v.role === "CLIENT" ? "Kundinloggningen ser bara de här kundernas rapporter i kundportalen." : "Utan val ser personen alla kunder."}</p>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending || !v.email}>
              {pending && <Loader2 className="animate-spin" />} Skicka inbjudan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Välj kunder. `allLabel` = alternativ för "alla" (tom lista); null för kundinloggningar.
 * Ändringar sparas när listan stängs, eller direkt med `live`.
 */
function ClientPicker(p: { clients: ClientOption[]; value: string[]; label: string; allLabel: string | null; ariaLabel: string; onCommit: (ids: string[]) => void; live?: boolean; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(p.value);
  const set = (ids: string[]) => (p.live ? p.onCommit(ids) : setDraft(ids));
  const current = p.live ? p.value : draft;
  const toggle = (id: string) => set(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(p.value);
        else if (!p.live && (draft.length !== p.value.length || draft.some((d) => !p.value.includes(d)))) p.onCommit(draft);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-between font-normal", p.wide ? "w-full" : "w-40")} aria-label={`${p.label} (${p.ariaLabel})`}>
          <span className="truncate">{p.label}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Sök kund …" />
          <CommandList>
            <CommandEmpty>Inga kunder.</CommandEmpty>
            {p.allLabel && (
              <CommandGroup>
                <CommandItem value="__all__" onSelect={() => set([])}>
                  <Check className={cn("size-4", current.length === 0 ? "opacity-100" : "opacity-0")} />
                  {p.allLabel}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Bara valda kunder">
              {p.clients.map((c) => (
                <CommandItem key={c.id} value={c.name} onSelect={() => toggle(c.id)}>
                  <Check className={cn("size-4", current.includes(c.id) ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
