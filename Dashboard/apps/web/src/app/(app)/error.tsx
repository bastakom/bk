"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";

/** Oväntat fel i appen: förklara, låt användaren försöka igen och visa felkoden för support. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <StateView
      icon={<AlertTriangle />}
      title="Sidan kunde inte visas"
      text={
        <>
          Något gick fel när sidan hämtades. Ingenting har sparats eller ändrats. Försök igen om en stund.
          {error.digest && <span className="mt-2 block text-xs">Felkod för support: {error.digest}</span>}
        </>
      }
    >
      <Button onClick={reset}>
        <RotateCcw /> Försök igen
      </Button>
      <Button asChild variant="outline">
        <Link href="/clients">Till kunderna</Link>
      </Button>
    </StateView>
  );
}
