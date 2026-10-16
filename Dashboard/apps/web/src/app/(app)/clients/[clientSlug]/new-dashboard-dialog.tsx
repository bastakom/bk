"use client";

import { LayoutTemplate, Plus } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDashboard } from "./dashboard-actions";

export function NewDashboardDialog({
  clientId,
  clientSlug,
  templates,
  trigger = "button",
  defaultOpen = false,
}: {
  clientId: string;
  clientSlug: string;
  templates: { id: string; name: string; widgets: number }[];
  /** "primary": huvudknapp, "tile": streckad ruta i dashboardlistan */
  trigger?: "button" | "primary" | "tile";
  defaultOpen?: boolean;
}) {
  const [state, action, pending] = useActionState(createDashboard, null);
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        {trigger === "tile" ? (
          <button
            type="button"
            className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-heading/20 text-sm font-semibold text-heading transition-colors outline-none hover:border-heading/40 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden>
              <Plus className="size-5" />
            </span>
            Ny dashboard
          </button>
        ) : (
          <Button variant={trigger === "primary" ? "default" : "outline"} size={trigger === "primary" ? "lg" : "sm"}>
            <Plus /> Ny dashboard
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form action={action} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Ny dashboard</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="clientId" value={clientId} />
          <div className="space-y-2">
            <Label htmlFor="dashboard-name">Namn</Label>
            <Input id="dashboard-name" name="name" placeholder="Månadsrapport" required autoFocus />
          </div>
          {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Skapa tom dashboard
            </Button>
          </DialogFooter>
          {templates.length > 0 && (
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Eller utgå från en mall</p>
              <ul className="space-y-1">
                {templates.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/apply?template=${t.id}&client=${clientSlug}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <LayoutTemplate className="size-4 text-muted-foreground" />
                      <span className="flex-1">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.widgets} widgets</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
