import { cn } from "@/lib/utils";

/** Tangent i en genväg, t.ex. <Kbd>⌘</Kbd><Kbd>K</Kbd>. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("inline-grid h-5 min-w-5 place-items-center rounded border border-b-2 bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground", className)}>{children}</kbd>;
}
