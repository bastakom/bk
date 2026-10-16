"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

const MESSAGES: Record<string, ["success" | "error", string]> = {
  connected: ["success", "Inloggningen är kopplad. Välj källor för kunderna på respektive kundsida."],
  reconnected: ["success", "Inloggningen är omkopplad. Källor som kunder använder synkas nu."],
  denied: ["error", "Åtkomst nekades hos plattformen."],
  invalid_state: ["error", "Inloggningen kunde inte verifieras. Försök igen."],
  list_failed: ["error", "Inloggningen är sparad, men kontona kunde inte hämtas. Tryck Uppdatera kontolista på inloggningen för att försöka igen."],
  ads_access_level: ["error", "Inloggningen är sparad, men Google Ads-åtkomsten är bara godkänd för testkonton. Riktiga konton visas när åtkomstnivån Explorer är godkänd i Google Cloud Console."],
  ads_developer_token: ["error", "Inloggningen är sparad, men Google Ads kräver en godkänd åtkomstnivå (eller utvecklartoken) för Cloud-projektet."],
};

export function OAuthToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.get("oauth");
  useEffect(() => {
    const msg = key ? MESSAGES[key] : undefined;
    if (!msg) return;
    const found = params.get("found");
    toast[msg[0]](found !== null && key === "connected" ? `${found} konton hittades. ${msg[1]}` : msg[1]);
    // Behåll markeringen av den nya inloggningen men ta bort aviseringsparametrarna.
    const keep = params.get("connection");
    router.replace(keep ? `${pathname}?connection=${keep}` : pathname, { scroll: false });
  }, [key, params, pathname, router]);
  return null;
}
