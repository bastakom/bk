"use client";

import { CheckCircle2, Copy, Globe, Loader2, Mail, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveWhiteLabel, verifyDomain, verifySender } from "./actions";

interface Props {
  initial: { customDomain: string; emailFromName: string; emailFrom: string };
  domainVerified: boolean;
  senderVerified: boolean;
  /** CNAME-mål och TXT-värde */
  dns: { appHost: string; txtName: string; txtValue: string };
  canEdit: boolean;
}

/** Egen domän för delade länkar och egen avsändare för utskick och larm. */
export function WhiteLabelForm(props: Props) {
  const [v, setV] = useState(props.initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(props.initial);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message ?? "Klart");
      else toast.error(res.error, { duration: 8000 });
    });

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Kopierat"));
  const domain = props.initial.customDomain;

  return (
    <fieldset disabled={!props.canEdit} className="mt-10 space-y-6 border-t pt-8">
      <legend className="sr-only">Egen domän och avsändare</legend>
      <div>
        <h2 className="text-xl text-heading">Egen domän och avsändare</h2>
        <p className="mt-1 text-sm text-muted-foreground">Delade länkar på er domän (t.ex. rapport.bastakompisar.se) och utskick från er adress.</p>
      </div>

      <section aria-labelledby="wl-domain" className="space-y-3">
        <h3 id="wl-domain" className="flex items-center gap-2 text-sm font-medium">
          <Globe className="size-4" aria-hidden /> Domän för delade länkar
          <Status ok={props.domainVerified} label={props.domainVerified ? "Aktiv" : domain ? "Inte verifierad" : "Ingen"} />
        </h3>
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="wl-domain-input">Domän</Label>
          <Input id="wl-domain-input" value={v.customDomain} onChange={(e) => setV({ ...v, customDomain: e.target.value })} placeholder="rapport.bastakompisar.se" />
        </div>
        {domain && !dirty && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="mb-2 font-medium">Lägg in två DNS-poster hos er domänleverantör:</p>
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Typ</th>
                  <th className="py-1 pr-3 font-medium">Namn</th>
                  <th className="py-1 font-medium">Värde</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  ["CNAME", domain, props.dns.appHost],
                  ["TXT", props.dns.txtName, props.dns.txtValue],
                ].map(([type, name, value]) => (
                  <tr key={type} className="border-t align-top">
                    <td className="py-1.5 pr-3">{type}</td>
                    <td className="py-1.5 pr-3 break-all">{name}</td>
                    <td className="py-1.5 break-all">
                      {value}{" "}
                      <button type="button" className="ml-1 inline-flex align-middle text-muted-foreground hover:text-foreground" onClick={() => copy(value!)} aria-label={`Kopiera ${type}-värdet`}>
                        <Copy className="size-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">Domänen måste också ha ett TLS-certifikat där appen driftas. Befintliga länkar på appens adress fortsätter att fungera.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => run(verifyDomain)} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Kontrollera DNS
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="wl-sender" className="space-y-3">
        <h3 id="wl-sender" className="flex items-center gap-2 text-sm font-medium">
          <Mail className="size-4" aria-hidden /> Avsändare för utskick och larm
          <Status ok={props.senderVerified} label={props.senderVerified ? "Aktiv" : props.initial.emailFrom ? "Inte verifierad" : "Standard"} />
        </h3>
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wl-from-name">Namn</Label>
            <Input id="wl-from-name" value={v.emailFromName} onChange={(e) => setV({ ...v, emailFromName: e.target.value })} placeholder="Bästa Kompisar" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wl-from">E-postadress</Label>
            <Input id="wl-from" type="email" value={v.emailFrom} onChange={(e) => setV({ ...v, emailFrom: e.target.value })} placeholder="rapport@bastakompisar.se" />
          </div>
        </div>
        {props.initial.emailFrom && !dirty && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => run(verifySender)} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Kontrollera avsändare
            </Button>
            <p className="text-xs text-muted-foreground">Domänen ({props.initial.emailFrom.split("@")[1]}) måste vara verifierad i Resend (SPF och DKIM).</p>
          </div>
        )}
      </section>

      {props.canEdit && (
        <Button onClick={() => run(() => saveWhiteLabel(v))} disabled={pending || !dirty}>
          {pending && <Loader2 className="animate-spin" />} Spara domän och avsändare
        </Button>
      )}
    </fieldset>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success" : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"}>
      {ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />} {label}
    </span>
  );
}
