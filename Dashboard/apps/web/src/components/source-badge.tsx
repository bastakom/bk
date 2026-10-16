import { PLATFORMS, type PlatformId } from "@rp/core";
import { PlatformIcon } from "@/components/platform-icon";
import { cn } from "@/lib/utils";

/** Datakälla med ikon och namn (aldrig bara färg). */
export function SourceBadge({ platform, label, className }: { platform: PlatformId; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card py-0.5 pr-2.5 pl-0.5 text-xs font-medium", className)}>
      <PlatformIcon platform={platform} size="sm" className="rounded-full" />
      <span className="truncate">{label ?? PLATFORMS[platform].label}</span>
    </span>
  );
}
