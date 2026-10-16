"use client";

import { CalendarCheck, Copy, LayoutTemplate, MoreHorizontal, PencilLine, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DashboardRange } from "@/lib/dashboard-data";
import { deleteDashboard, duplicateDashboard, saveAsTemplate, updateDashboard } from "./actions";

type DialogKind = "rename" | "template" | "copy" | "delete" | null;

export function DashboardMenu({
  dashboard,
  otherClients,
  range,
}: {
  dashboard: { id: string; name: string };
  clientSlug: string;
  otherClients: { id: string; name: string; slug: string }[];
  range: DashboardRange;




}) {
  const saveDefaultRange = () =>
    run(() =>
      updateDashboard(dashboard.id, {
        settings: {
          range: { preset: range.preset, ...(range.preset === "custom" ? { start: range.range.start, end: range.range.end } : {}) },
          compare: range.compare,
        },
      }),
    );
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, start] = useTransition();
  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState<string>("");

  const close = () => setDialog(null);
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (res.message) toast.success(res.message);
        after?.();
        close();
      } else toast.error(res.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Fler val för dashboarden">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => setDialog("rename")}>
            <PencilLine /> Byt namn
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => start(async () => void (await duplicateDashboard(dashboard.id)))}>
            <Copy /> Duplicera
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("copy")} disabled={otherClients.length === 0}>
            <Send /> Kopiera till annan kund…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={saveDefaultRange}>
            <CalendarCheck /> Spara vald period som standard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (setName(dashboard.name), setDialog("template"))}>
            <LayoutTemplate /> Spara som mall…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
            <Trash2 /> Radera dashboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "rename"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Byt namn</DialogTitle>
          </DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Namn" autoFocus />
          <DialogFooter>
            <Button disabled={pending} onClick={() => run(() => updateDashboard(dashboard.id, { name }))}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "template"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Spara som mall</DialogTitle>
            <DialogDescription>Mallen sparas på byrånivå utan kundens konton. När den används på en ny kund mappar du bara källorna.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Namn</Label>
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Beskrivning (valfri)</Label>
              <Textarea id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={() => run(() => saveAsTemplate(dashboard.id, { name, description }))}>
              Spara mall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "copy"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kopiera till annan kund</DialogTitle>
            <DialogDescription>I nästa steg kopplar du dashboardens källor till den andra kundens konton.</DialogDescription>
          </DialogHeader>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full" aria-label="Kund">
              <SelectValue placeholder="Välj kund" />
            </SelectTrigger>
            <SelectContent>
              {otherClients.map((c) => (
                <SelectItem key={c.id} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button disabled={!target} onClick={() => router.push(`/apply?dashboard=${dashboard.id}&client=${target}`)}>
              Fortsätt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Radera {dashboard.name}?</DialogTitle>
            <DialogDescription>Dashboarden och dess widgets raderas. Kopplade konton och data påverkas inte.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" disabled={pending} onClick={() => start(async () => void (await deleteDashboard(dashboard.id)))}>
              Radera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
