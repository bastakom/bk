"use client";

import { formatRange } from "@rp/core";
import { AlertTriangle, CheckCircle2, Loader2, Lock, Sparkles, Target, Trash2, TrendingUp, Users, Image as ImageIcon, Wallet, ListChecks, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { createInsight, deleteInsight, loadInsights, type InsightView } from "./insight-actions";

const fmtDate = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS_TONE = { bra: "bg-success-soft text-success", blandat: "bg-warning-soft text-warning", "behöver åtgärd": "bg-danger-soft text-destructive" } as const;
const PRIO_TONE = { hög: "bg-danger-soft text-destructive", medel: "bg-warning-soft text-warning", låg: "bg-muted text-muted-foreground" } as const;
const FIT_LABEL = { god: "Rätt målgrupp", delvis: "Delvis rätt målgrupp", svag: "Fel målgrupp", okänd: "Målgrupp okänd" } as const;

/** Intern AI-analys av rapportens period. Visas aldrig för kunden (inte på delade länkar, i PDF eller utskick). */
export function InsightPanel({
  open,
  onOpenChange,
  dashboardId,
  clientSlug,
  canEdit,
  periodLabel,
  hasBrief,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dashboardId: string;
  clientSlug: string;
  canEdit: boolean;
  periodLabel: string;
  hasBrief: boolean;
}) {
  const sp = useSearchParams();
  const [state, setState] = useState<{ configured: boolean; insights: InsightView[] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [deleting, startDelete] = useTransition();

  const refresh = async (select?: string) => {
    const res = await loadInsights(dashboardId);
    setState(res);
    setSelected(select ?? res.insights[0]?.id ?? null);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadInsights(dashboardId).then((res) => {
      if (cancelled) return;
      setState(res);
      setSelected((s) => s ?? res.insights[0]?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, dashboardId]);

  const analyze = () =>
    startGenerate(async () => {
      const res = await createInsight(dashboardId, Object.fromEntries(sp.entries()));
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Analysen är klar.");
      await refresh(res.data);
    });

  const current = state?.insights.find((i) => i.id === selected) ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-highlight" aria-hidden /> AI-analys
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1">
            <Lock className="size-3" aria-hidden /> Internt för byrån – visas aldrig för kunden.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4">
          {state && !state.configured && (
            <div role="alert" className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
              AI-analysen är inte aktiverad. Lägg till <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> i <code className="font-mono text-xs">.env</code> och starta om appen.
            </div>
          )}

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={analyze} disabled={generating || !state?.configured}>
                {generating ? <Loader2 className="animate-spin" /> : <Sparkles />} Analysera {periodLabel}
              </Button>
              {!hasBrief && (
                <p className="text-xs text-muted-foreground">
                  Tips:{" "}
                  <Link href={`/clients/${clientSlug}`} className="font-medium text-link underline-offset-2 hover:underline">
                    lägg in kundens mål och kundprofil
                  </Link>{" "}
                  för en analys mot målen.
                </p>
              )}
            </div>
          )}
          {generating && (
            <p role="status" className="text-sm text-muted-foreground">
              Analyserar kampanjer, målgrupper och annonser. Det tar oftast en halv till en minut …
            </p>
          )}

          {state && state.insights.length > 1 && (
            <Select value={selected ?? undefined} onValueChange={setSelected}>
              <SelectTrigger className="w-full" aria-label="Tidigare analyser">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.insights.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {formatRange(i.period)} · {fmtDate.format(new Date(i.createdAt))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!state && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-label="Laddar" />}
          {state && state.insights.length === 0 && !generating && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Ingen analys än. {canEdit ? "Välj period i rapporten och tryck Analysera." : ""}</p>
          )}

          {current && <InsightView insight={current} />}

          {current && canEdit && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    const res = await deleteInsight(current.id);
                    if (!res.ok) return void toast.error(res.error);
                    await refresh();
                  })
                }
              >
                <Trash2 /> Ta bort analysen
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InsightView({ insight: i }: { insight: InsightView }) {
  const c = i.content;
  return (
    <article aria-label="Analys" className="space-y-6">
      <header className="space-y-2 rounded-xl bg-accent/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[c.status])}>{c.status === "bra" ? "Går bra" : c.status === "blandat" ? "Blandat" : "Behöver åtgärd"}</span>
          <span className="text-xs text-muted-foreground">
            {formatRange(i.period)}
            {i.compare && ` mot ${formatRange(i.compare)}`}
          </span>
        </div>
        <p className="text-lg leading-snug text-heading">{c.headline}</p>
        <p className="text-sm leading-relaxed">{c.summary}</p>
      </header>

      <Section icon={<CheckCircle2 className="size-4 text-success" />} title="Det här fungerar">
        <Points items={c.whatWorks} />
      </Section>

      <Section icon={<TrendingUp className="size-4 text-warning" />} title="Det här kan bli bättre">
        <Points items={c.improvements} />
      </Section>

      <Section icon={<Users className="size-4" />} title="Målgrupp">
        <p className="mb-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{FIT_LABEL[c.audience.fit]}</span>
        </p>
        <p className="text-sm leading-relaxed">{c.audience.assessment}</p>
        {c.audience.findings.length > 0 && <Points items={c.audience.findings} className="mt-3" />}
      </Section>

      {c.creatives.length > 0 && (
        <Section icon={<ImageIcon className="size-4" />} title="Annonser">
          <ul className="space-y-3">
            {c.creatives.map((a, n) => (
              <li key={n} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{a.ad}</p>
                <p className="mt-1 leading-relaxed">{a.verdict}</p>
                <p className="mt-1.5 leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Förslag:</span> {a.suggestion}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={<ListChecks className="size-4 text-highlight" />} title="Nästa steg för dig">
        <ol className="space-y-2">
          {c.actions.map((a, n) => (
            <li key={n} className="rounded-lg border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{a.title}</span>
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", PRIO_TONE[a.priority])}>{a.priority} prio</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{a.effort} insats</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{a.timeframe}</span>
              </div>
              <p className="mt-1 leading-relaxed text-muted-foreground">{a.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section icon={<Wallet className="size-4" />} title="Budget">
        <p className="text-sm leading-relaxed">{c.budget}</p>
      </Section>

      {c.dataGaps.length > 0 && (
        <Section icon={<HelpCircle className="size-4" />} title="Saknas i underlaget">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {c.dataGaps.map((g, n) => (
              <li key={n}>{g}</li>
            ))}
          </ul>
        </Section>
      )}

      <footer className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
        <Target className="size-3" aria-hidden />
        {fmtDate.format(new Date(i.createdAt))}
        {i.createdBy && ` · ${i.createdBy}`} · {i.model}
        <AlertTriangle className="ml-2 size-3" aria-hidden /> AI kan ha fel – kontrollera mot siffrorna.
      </footer>
    </article>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium tracking-wide uppercase">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function Points({ items, className }: { items: { title: string; detail: string; evidence?: string; priority?: "hög" | "medel" | "låg" }[]; className?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">–</p>;
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((p, n) => (
        <li key={n} className="text-sm">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {p.title}
            {p.priority && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", PRIO_TONE[p.priority])}>{p.priority} prio</span>}
          </p>
          <p className="mt-0.5 leading-relaxed text-muted-foreground">{p.detail}</p>
          {p.evidence && <p className="tabular mt-0.5 text-xs text-muted-foreground/80">{p.evidence}</p>}
        </li>
      ))}
    </ul>
  );
}
