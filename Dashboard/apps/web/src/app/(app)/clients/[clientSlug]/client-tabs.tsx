"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ClientTab {
  id: string;
  label: string;
  count?: number;
  /** Visar en varningsmarkering, t.ex. en källa med synkfel */
  alert?: boolean;
  content: React.ReactNode;
}

/** Kundsidans flikar. Aktiv flik ligger i URL:en (?tab=), så att länkar och bakåtknappen fungerar. */
export function ClientTabs({ tabs }: { tabs: ClientTab[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = tabs.some((t) => t.id === sp.get("tab")) ? sp.get("tab")! : tabs[0]!.id;
  return (
    <Tabs
      value={active}
      onValueChange={(v) => {
        const next = new URLSearchParams(sp);
        next.delete("ny");
        if (v === tabs[0]!.id) next.delete("tab");
        else next.set("tab", v);
        router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
      }}
    >
      <TabsList variant="line" className="h-auto! w-full justify-start gap-1 overflow-x-auto border-b p-0">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="group/trig relative h-11 flex-none px-3 text-[15px] after:hidden data-[state=active]:font-semibold data-[state=active]:text-heading">
            {t.label}
            {t.count !== undefined && <span className="tabular rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{t.count}</span>}
            {t.alert && <span className="size-2 rounded-full bg-destructive" aria-label="behöver åtgärd" />}
            <span aria-hidden className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary opacity-0 transition-opacity group-data-[state=active]/trig:opacity-100" />
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="pt-6">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
