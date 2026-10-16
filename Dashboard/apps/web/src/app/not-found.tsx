import { SearchX } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sidan finns inte" };

/** Okända adresser och sidor utanför appen (t.ex. utgångna delningslänkar). */
export default function NotFound() {
  return (
    <div className="min-h-svh bg-background">
      <div className="p-6">
        <Logo />
      </div>
      <StateView
        icon={<SearchX />}
        title="Sidan finns inte"
        text="Länken kan vara felskriven, ha gått ut eller ha stängts av. Har du fått en rapportlänk kan du be avsändaren om en ny."
      >
        <Button asChild variant="outline">
          <Link href="/">Till startsidan</Link>
        </Button>
      </StateView>
    </div>
  );
}
