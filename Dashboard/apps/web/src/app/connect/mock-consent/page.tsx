import { PLATFORMS, type PlatformId } from "@rp/core";
import { getConnector } from "@rp/core/server";
import { ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Godkänn åtkomst (mock)" };

/**
 * Simulerar plattformens samtyckessida i mockläge, så att hela OAuth-flödet
 * (state, callback, krypterad lagring) körs precis som mot en riktig källa.
 */
export default async function MockConsentPage({ searchParams }: PageProps<"/connect/mock-consent">) {
  const sp = await searchParams;
  const connectorId = String(sp.connector ?? "");
  const state = String(sp.state ?? "");
  const redirect = String(sp.redirect_uri ?? "");
  const allowedOrigin = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
  let connector;
  try {
    connector = getConnector(connectorId);
  } catch {
    notFound();
  }
  if (!connector.isMock || new URL(redirect).origin !== allowedOrigin) notFound();

  const approve = new URL(redirect);
  approve.searchParams.set("code", crypto.randomUUID());
  approve.searchParams.set("state", state);
  const deny = new URL(redirect);
  deny.searchParams.set("error", "access_denied");
  deny.searchParams.set("state", state);
  const platform = PLATFORMS[connector.platform as PlatformId];

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-soft">
        <PlatformIcon platform={connector.platform} size="lg" className="mx-auto" />
        <p className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Simulerad inloggning</p>
        <h1 className="mt-4 text-lg font-semibold">Rapportplattformen vill läsa data från {platform.label}</h1>
        <ul className="mt-5 space-y-2 text-left text-sm text-muted-foreground">
          <li className="flex gap-2">
            <ShieldCheck className="size-4 shrink-0 text-success" /> Endast läsrättigheter ({connector.auth.scopes.join(", ")})
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="size-4 shrink-0 text-success" /> Du kan återkalla åtkomsten när som helst
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild>
            <a href={approve.toString()}>Godkänn</a>
          </Button>
          <Button asChild variant="ghost">
            <a href={deny.toString()}>Neka</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
