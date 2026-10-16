"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteClient } from "../actions";

export function ClientMenu({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Fler val för kunden">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 /> Radera kund och all data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Radera {clientName}</DialogTitle>
            <DialogDescription>
              Kunden, alla kopplade konton, dashboards och all synkad data raderas permanent (GDPR-radering). Skriv kundens namn för att bekräfta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-name">Kundens namn</Label>
            <Input id="confirm-name" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={clientName} autoComplete="off" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={confirm.trim() !== clientName || pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteClient(clientId, confirm);
                  if (res && !res.ok) setError(res.error);
                })
              }
            >
              Radera permanent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
