"use client";

import { Download, FileText, Loader2, ScrollText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const LAYOUTS = [
  { id: "paged", icon: FileText, label: "A4, paginerad", text: "Omslag, innehållsförteckning och sidnummer. Diagram och tabeller delas aldrig mitt itu." },
  { id: "long", icon: ScrollText, label: "En lång sida", text: "Hela dashboarden på en sida, som en webbsida. Bra för skärmläsning." },
] as const;

/** PDF-export. Styrs utifrån (open/onOpenChange) från "Dela och exportera", eller med egen knapp. */
export function ExportDialog({ dashboardId, periodLabel, open: openProp, onOpenChange }: { dashboardId: string; periodLabel: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const sp = useSearchParams();
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (o: boolean) => (controlled ? onOpenChange?.(o) : setOpenState(o));
  const [layout, setLayout] = useState<"paged" | "long">("paged");
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const q = new URLSearchParams(sp);
      q.set("layout", layout);
      const res = await fetch(`/api/dashboards/${dashboardId}/pdf?${q}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "PDF-exporten misslyckades.");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "rapport.pdf";
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`PDF klar (${res.headers.get("X-Page-Count")} sidor).`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF-exporten misslyckades.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button variant="outline">
            <Download /> PDF
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportera PDF</DialogTitle>
          <DialogDescription>Period: {periodLabel}. Samma data som visas just nu.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Layout" className="space-y-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={layout === l.id}
              onClick={() => setLayout(l.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                layout === l.id ? "border-primary bg-accent" : "hover:bg-muted/60",
              )}
            >
              <l.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="block text-sm font-medium">{l.label}</span>
                <span className="block text-xs text-muted-foreground">{l.text}</span>
              </span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={download} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            {busy ? "Skapar PDF…" : "Ladda ner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
