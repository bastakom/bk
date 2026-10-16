import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Bästa Kompisars logga (från bastakompisar.se) med produktnamnet.
 * Loggan är svart; `inverted` gör den vit för mörka ytor (sidomenyn, mörkt tema).
 */
export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src="/brand/bk-logo.png" alt="Bästa Kompisar" width={412} height={270} priority className={cn("h-7 w-auto", inverted ? "invert" : "dark:invert")} />
      <span className={cn("border-l pl-2.5 text-[15px] leading-none tracking-tight", inverted ? "border-white/25 text-white" : "border-foreground/20")}>Rapport</span>
    </span>
  );
}
