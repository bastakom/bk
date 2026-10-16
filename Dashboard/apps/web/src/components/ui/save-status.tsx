import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Synlig sparstatus för autosparning ("Sparar…", "Sparat", "Kunde inte spara"). Läses upp av skärmläsare. */
export function SaveStatus({ state, onRetry, className }: { state: SaveState; onRetry?: () => void; className?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", state === "error" && "text-destructive", className)}>
      {state === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Sparar…
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="size-3.5 text-success" aria-hidden /> Sparat
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="size-3.5" aria-hidden /> Kunde inte spara.
          {onRetry && (
            <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
              Försök igen
            </button>
          )}
        </>
      )}
    </span>
  );
}
