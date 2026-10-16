"use client";

import { ImageUp, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Väljer en bildfil och returnerar den som data-URL (kontroll av typ och storlek). */
export function LogoInput({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-14 w-28 place-items-center overflow-hidden rounded-lg border bg-muted/40">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="max-h-12 max-w-24 object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">Ingen logga</span>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 300_000) return toast.error("Loggan får vara högst 300 kB.");
          const reader = new FileReader();
          reader.onload = () => onChange(String(reader.result));
          reader.readAsDataURL(file);
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
        <ImageUp /> Välj bild
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="icon" aria-label="Ta bort logga" onClick={() => onChange(null)}>
          <X />
        </Button>
      )}
    </div>
  );
}
