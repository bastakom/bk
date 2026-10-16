"use client";

import { PLATFORMS, WIDGET_META, type PlatformId } from "@rp/core";
import { AlertTriangle, Database, Plus, X } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AccountInfo } from "@/lib/dashboard-data";
import type { DashboardWidget } from "@/lib/load-dashboard";
import { assignMissingSource, setReportSources, swapReportSource } from "./bulk-actions";

const ORDER: PlatformId[] = ["ga4", "google_ads", "meta_ads", "linkedin_ads", "tiktok_ads"];

export interface ReportSourceGroup {
  platform: PlatformId;
  /** Källor som widgets använder, med antal widgets */
  used: { account: AccountInfo; widgets: number }[];
  /** Standardkällor utan widgets (används av nya widgets) */
  defaults: AccountInfo[];
  /** Widgets som behöver kanalen men saknar källa för den */
  missing: number;
}

/** Sammanställer vilka källor rapporten använder, per kanal. */
export function reportSourceGroups(widgets: DashboardWidget[], accounts: AccountInfo[], settingsSources: string[]): ReportSourceGroup[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const data = widgets.filter((w) => WIDGET_META[w.type].needsData);
  const groups: ReportSourceGroup[] = [];
  for (const platform of ORDER) {
    const counts = new Map<string, number>();
    for (const w of data) for (const id of w.accountIds) if (byId.get(id)?.platform === platform) counts.set(id, (counts.get(id) ?? 0) + 1);
    const used = [...counts].map(([id, widgets]) => ({ account: byId.get(id)!, widgets }));
    const defaults = settingsSources.map((id) => byId.get(id)).filter((a): a is AccountInfo => !!a && a.platform === platform && !counts.has(a.id));
    const missing = data.filter((w) => w.config.sourcePlatforms.includes(platform) && !w.accountIds.some((id) => byId.get(id)?.platform === platform)).length;
    if (used.length || defaults.length || missing) groups.push({ platform, used, defaults, missing });
  }
  return groups;
}

/** Rapportens standardkällor för nya widgets: valda standardkällor, annars de som används. */
export function defaultReportSources(groups: ReportSourceGroup[]): string[] {
  return groups.flatMap((g) => (g.defaults.length ? [...g.used.map((u) => u.account.id), ...g.defaults.map((d) => d.id)] : g.used.map((u) => u.account.id)));
}

export function ReportSources({
  open,
  onOpenChange,
  dashboardId,
  clientSlug,
  widgets,
  accounts,
  settingsSources,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dashboardId: string;
  clientSlug: string;
  widgets: DashboardWidget[];
  accounts: AccountInfo[];
  settingsSources: string[];
}) {
  const [pending, start] = useTransition();
  const groups = reportSourceGroups(widgets, accounts, settingsSources);
  const inReport = new Set(groups.flatMap((g) => [...g.used.map((u) => u.account.id), ...g.defaults.map((d) => d.id)]));
  const addable = accounts.filter((a) => !inReport.has(a.id));

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message ?? "Sparat");
      else toast.error(res.error);
    });

  const choices = (platform: PlatformId) => accounts.filter((a) => a.platform === platform);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Rapportens källor</SheetTitle>
          <SheetDescription>Byt t.ex. GA4-property eller Google Ads-konto för hela rapporten på en gång. Nya widgets använder rapportens källor automatiskt.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {accounts.length === 0 && (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              <Database className="mx-auto mb-2 size-5" />
              Kunden har inga källor än.{" "}
              <Link href={`/clients/${clientSlug}`} className="font-medium text-link underline-offset-2 hover:underline">
                Välj källor på kundsidan
              </Link>
            </div>
          )}

          {groups.map((g) => {
            const options = choices(g.platform);
            return (
              <section key={g.platform} aria-label={PLATFORMS[g.platform].label} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <PlatformIcon platform={g.platform} size="sm" /> {PLATFORMS[g.platform].label}
                </h3>

                {g.used.map(({ account, widgets: n }) => (
                  <div key={account.id} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                    <div className="min-w-0 flex-1">
                      <Select value={account.id} disabled={pending} onValueChange={(to) => to !== account.id && run(() => swapReportSource(dashboardId, account.id, to))}>
                        <SelectTrigger className="w-full" aria-label={`Byt ${account.name} i rapporten`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{n} widgets</span>
                  </div>
                ))}

                {g.defaults.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg border border-dashed p-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">För nya widgets</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={pending}
                      aria-label={`Ta bort ${a.name} ur rapportens källor`}
                      onClick={() => run(() => setReportSources(dashboardId, settingsSources.filter((s) => s !== a.id)))}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}

                {g.missing > 0 && (
                  <div className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft p-2.5">
                    <p className="flex items-center gap-1.5 text-sm">
                      <AlertTriangle className="size-3.5 text-warning" aria-hidden />
                      {g.missing} widgets saknar {PLATFORMS[g.platform].label}-källa
                    </p>
                    {options.length ? (
                      <Select disabled={pending} onValueChange={(to) => run(() => assignMissingSource(dashboardId, g.platform, to))}>
                        <SelectTrigger className="w-full bg-card" aria-label={`Välj ${PLATFORMS[g.platform].label}-källa för widgets som saknar källa`}>
                          <SelectValue placeholder="Välj källa för dem …" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Kunden har ingen {PLATFORMS[g.platform].label}-källa.{" "}
                        <Link href={`/clients/${clientSlug}`} className="font-medium text-link underline-offset-2 hover:underline">
                          Välj en på kundsidan
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {addable.length > 0 && (
            <section aria-label="Lägg till källa" className="space-y-2 border-t pt-4">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <Plus className="size-3.5" /> Lägg till källa i rapporten
              </h3>
              <Select disabled={pending} onValueChange={(id) => run(() => setReportSources(dashboardId, [...settingsSources, id]))}>
                <SelectTrigger className="w-full" aria-label="Lägg till källa i rapporten">
                  <SelectValue placeholder="Välj bland kundens källor …" />
                </SelectTrigger>
                <SelectContent>
                  {addable.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <PlatformIcon platform={a.platform} size="sm" /> {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Nya widgets för kanalen får källan automatiskt.</p>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
