"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LogoInput } from "@/components/logo-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND_FONTS, brandScope, contrast, DEFAULT_BRAND_COLOR } from "@/lib/brand";
import { saveBrand } from "./actions";

export function BrandForm({ initial, canEdit }: { initial: { name: string; brandColor: string; fontFamily: string; logoUrl: string | null }; canEdit: boolean }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const ratio = contrast(v.brandColor, "#ffffff");

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_18rem]">
      <fieldset disabled={!canEdit} className="space-y-5">
        <legend className="mb-1 text-xl text-heading">Varumärke (white label)</legend>
        <p className="text-sm text-muted-foreground">Används i appen, på delade länkar till kunder, i PDF-rapporter och i mejl.</p>
        <div className="space-y-1.5">
          <Label htmlFor="b-name">Byråns namn</Label>
          <Input id="b-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Logga</Label>
          <LogoInput value={v.logoUrl} onChange={(logoUrl) => setV({ ...v, logoUrl })} label="Byråns logga" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="b-color">Accentfärg</Label>
            <div className="flex items-center gap-2">
              <Input id="b-color" type="color" value={v.brandColor} onChange={(e) => setV({ ...v, brandColor: e.target.value })} className="h-9 w-14 p-1" />
              <Input value={v.brandColor} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setV({ ...v, brandColor: e.target.value })} className="font-mono" aria-label="Färgkod" />
            </div>
            <p className={`flex items-center gap-1 text-xs ${ratio >= 3 ? "text-muted-foreground" : "text-warning"}`}>
              {ratio >= 3 ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
              Kontrast mot vit bakgrund {ratio.toFixed(1)}:1 {ratio >= 3 ? "" : "– för ljus för knappar och diagram (minst 3:1)"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-typsnitt">Typsnitt</Label>
            <Select value={v.fontFamily} onValueChange={(fontFamily) => setV({ ...v, fontFamily })}>
              <SelectTrigger id="f-typsnitt" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BRAND_FONTS).map(([k, f]) => (
                  <SelectItem key={k} value={k} style={{ fontFamily: `var(${f.variable})` }}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {canEdit && (
          <Button
            disabled={pending || !/^#[0-9a-fA-F]{6}$/.test(v.brandColor)}
            onClick={() =>
              start(async () => {
                const res = await saveBrand(v);
                if (res.ok) toast.success(res.message);
                else toast.error(res.error);
              })
            }
          >
            Spara
          </Button>
        )}
      </fieldset>

      <div aria-label="Förhandsvisning" className="brand-scope h-fit overflow-hidden rounded-xl border bg-card shadow-soft" {...brandScope(/^#[0-9a-fA-F]{6}$/.test(v.brandColor) ? v.brandColor : DEFAULT_BRAND_COLOR, v.fontFamily)}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          {v.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logoUrl} alt="" className="h-6 object-contain" />
          ) : (
            <span className="text-sm font-semibold">{v.name}</span>
          )}
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">Live</span>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Besök</p>
          <p className="text-2xl font-semibold tracking-tight">13 302</p>
          <svg viewBox="0 0 100 30" className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
            <path d="M0 24 L15 18 L30 20 L45 12 L60 14 L75 6 L100 9" fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <Button size="sm" className="w-full">
            Öppna rapporten
          </Button>
        </div>
      </div>
    </div>
  );
}
