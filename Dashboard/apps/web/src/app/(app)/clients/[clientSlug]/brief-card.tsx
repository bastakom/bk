"use client";

import { Loader2, Lock, Pencil, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { briefIsEmpty, GOALS, type Brief } from "@/lib/ai/brief";
import { saveClientBrief } from "../actions";

/** Kundprofil (inriktning, målgrupp, erbjudande) som AI-analysen utgår från. Mätbara mål och budget ligger i GoalsCard. Visas aldrig för kunden. */
export function BriefCard({ clientId, brief, canEdit }: { clientId: string; brief: Brief; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Brief>(brief);
  const [pending, start] = useTransition();
  const empty = briefIsEmpty(brief);

  const save = () =>
    start(async () => {
      const res = await saveClientBrief(clientId, v);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setOpen(false);
    });

  const rows: [string, string | undefined][] = [
    ["Inriktning", GOALS.find((g) => g.id === brief.goal)?.label],
    ["Målgrupp", brief.audience],
    ["Marknader", brief.markets],
    ["Erbjudande", brief.offer],
    ["Övrigt", brief.notes],
  ];

  return (
    <section aria-labelledby="brief-heading" className="rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="brief-heading" className="flex items-center gap-2 text-xl font-bold tracking-tight text-heading">
            <UserRound className="size-4" aria-hidden /> Kundprofil
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden /> Internt – används av AI-analysen och visas aldrig för kunden
          </p>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setV(brief);
              setOpen(true);
            }}
          >
            <Pencil /> {empty ? "Fyll i" : "Redigera"}
          </Button>
        )}
      </div>
      {empty ? (
        <p className="mt-3 text-sm text-muted-foreground">Ingen kundprofil ifylld. Med inriktning, målgrupp och erbjudande kan AI-analysen bedöma om annonserna når rätt personer med rätt budskap.</p>
      ) : (
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows
            .filter(([, val]) => val)
            .map(([label, val]) => (
              <div key={label} className={label === "Målgrupp" || label === "Övrigt" ? "sm:col-span-2" : undefined}>
                <dt className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">{label}</dt>
                <dd className="mt-0.5 text-sm whitespace-pre-line">{val}</dd>
              </div>
            ))}
        </dl>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kundprofil</DialogTitle>
            <DialogDescription>Internt underlag för AI-analysen. Ju mer konkret, desto bättre bedömning. Siffermål och budget anges under Mål och budget.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Inriktning</Label>
              <Select value={v.goal ?? ""} onValueChange={(goal) => setV({ ...v, goal })}>
                <SelectTrigger className="w-full" aria-label="Inriktning">
                  <SelectValue placeholder="Vad ska marknadsföringen främst ge?" />
                </SelectTrigger>
                <SelectContent>
                  {GOALS.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              id="b-audience"
              label="Målgrupp"
              value={v.audience}
              rows={4}
              placeholder="Vem ska nås? Ålder, kön, livssituation, intressen, yrken/beslutsfattare, köpbeteende …"
              onChange={(audience) => setV({ ...v, audience })}
              wide
            />
            <Field id="b-markets" label="Marknader och geografi" value={v.markets} placeholder="T.ex. Skåne, hela Sverige, Norden" onChange={(markets) => setV({ ...v, markets })} />
            <Field id="b-offer" label="Erbjudande och USP" value={v.offer} placeholder="Vad säljs, varför välja kunden, säsong" onChange={(offer) => setV({ ...v, offer })} />
            <Field id="b-notes" label="Övrigt" value={v.notes} rows={3} placeholder="Kampanjperioder, begränsningar, tonalitet, tidigare lärdomar …" onChange={(notes) => setV({ ...v, notes })} wide />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field(props: { id: string; label: string; value?: string; placeholder: string; rows?: number; wide?: boolean; onChange: (v: string) => void }) {
  return (
    <div className={props.wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={props.id}>{props.label}</Label>
      <Textarea id={props.id} rows={props.rows ?? 2} value={props.value ?? ""} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}
