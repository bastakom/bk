import { cn } from "@/lib/utils";

/** Helsidesläge för fel, saknad sida och saknad behörighet: ikon, rubrik, förklaring och åtgärder. */
export function StateView({ icon, title, text, children, className }: { icon: React.ReactNode; title: string; text: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-[70svh] flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-heading">{title}</h1>
      <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{text}</div>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
