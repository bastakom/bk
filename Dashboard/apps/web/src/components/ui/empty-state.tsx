import { cn } from "@/lib/utils";

/** Tomt tillstånd i en yta: ikon, rubrik, förklaring och helst en primär åtgärd. */
export function EmptyState({ icon, title, text, action, className }: { icon: React.ReactNode; title: string; text: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <p className="mt-3 text-base font-medium text-heading">{title}</p>
      <div className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</div>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
