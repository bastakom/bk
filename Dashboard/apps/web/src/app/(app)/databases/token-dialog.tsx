"use client";

import { ExternalLink, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectWithToken } from "./actions";

export function TokenDialog(props: {
  connectorId: string;
  label: string;
  tokenLabel: string;
  help: string;
  helpUrl?: string;
  scopes: string[];
  /** Öppnas direkt (t.ex. från "Koppla om") */
  defaultOpen?: boolean;
  /** Inloggningen som ersätts vid "Koppla om" */
  reconnectConnectionId?: string;
  /** Egen knapp (t.ex. "Koppla om" i en meny) */
  trigger?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(connectWithToken, null);
  return (
    <Dialog defaultOpen={props.defaultOpen}>
      <DialogTrigger asChild>
        {props.trigger ?? (
          <Button className="w-full">
            <KeyRound /> Klistra in {props.tokenLabel.toLowerCase()}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={action} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{props.reconnectConnectionId ? "Koppla om" : "Koppla"} {props.label}</DialogTitle>
            <DialogDescription>{props.help}</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="connectorId" value={props.connectorId} />
          {props.reconnectConnectionId && <input type="hidden" name="reconnect" value={props.reconnectConnectionId} />}
          <div className="space-y-1.5">
            <Label htmlFor="token">{props.tokenLabel}</Label>
            {/* Lösenordsfält: token visas inte på skärmen och sparas inte av webbläsaren. */}
            <Input id="token" name="token" type="password" autoComplete="off" spellCheck={false} required className="font-mono" />
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <ShieldCheck className="size-3.5 shrink-0 text-success" /> Krypteras (AES-256) innan den sparas och visas aldrig igen.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="size-3.5 shrink-0 text-success" /> Behörighet som behövs: {props.scopes.join(", ")} (endast läsning).
            </li>
          </ul>
          {props.helpUrl && (
            <a href={props.helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline">
              Öppna inställningarna hos plattformen <ExternalLink className="size-3.5" />
            </a>
          )}
          {state && !state.ok && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Kontrollera och fortsätt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
