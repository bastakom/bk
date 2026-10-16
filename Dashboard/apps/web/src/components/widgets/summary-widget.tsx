"use client";

import { FileText } from "lucide-react";
import { TextWidget } from "./text-widget";
import type { WidgetViewProps } from "./types";

/** Kundens sammanfattning. Utkast visas bara för byrån (filtreras bort för kunden vid laddning). */
export function SummaryWidget(props: WidgetViewProps) {
  const draft = props.config.summaryStatus !== "published";
  return (
    <div className="space-y-3">
      {draft && !props.print && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
          <FileText className="size-3" aria-hidden /> Utkast – syns inte för kunden förrän det publiceras
        </p>
      )}
      {props.config.text?.trim() ? <TextWidget {...props} /> : <p className="text-sm text-muted-foreground">Ingen text än. Skriv själv eller låt AI skriva ett utkast.</p>}
    </div>
  );
}
