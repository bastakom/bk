import { friendlyError } from "@rp/core";
import { cn } from "@/lib/utils";

/** Begripligt felmeddelande, med den tekniska texten (utan sökvägar) hopfälld under. */
export function ErrorText({ error, className }: { error: string | null | undefined; className?: string }) {
  const e = friendlyError(error);
  if (!e) return null;
  return (
    <span className={cn("block max-w-md text-xs text-muted-foreground", className)}>
      {e.text}
      {e.detail && (
        <details className="mt-0.5">
          <summary className="w-fit cursor-pointer text-[11px] underline-offset-2 hover:underline">Teknisk information</summary>
          <span className="mt-0.5 block font-mono text-[11px] break-words">{e.detail}</span>
        </details>
      )}
    </span>
  );
}
