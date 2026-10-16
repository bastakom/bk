"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Etikett, kontroll, hjälptext och fel som hör ihop för skärmläsare.
 * children får id och aria-attribut via render-funktionen.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}) })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
