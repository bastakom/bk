import { PLATFORMS, type PlatformId } from "@rp/core";
import { PlatformIcon } from "@/components/platform-icon";
import type { WidgetViewProps } from "./types";

export function SectionWidget({ title, config }: WidgetViewProps) {
  const platform = config.platform as PlatformId | undefined;
  return (
    <div className="flex h-full items-center gap-3">
      {platform && PLATFORMS[platform] && <PlatformIcon platform={platform} size="lg" />}
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-heading">{title || (platform ? PLATFORMS[platform]?.label : "Sektion")}</h2>
        {config.text && <p className="text-sm text-muted-foreground">{config.text}</p>}
      </div>
    </div>
  );
}
