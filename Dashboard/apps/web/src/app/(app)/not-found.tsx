import { SearchX } from "lucide-react";
import Link from "next/link";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <StateView icon={<SearchX />} title="Sidan finns inte" text="Kunden eller rapporten kan ha tagits bort eller bytt namn, eller så har du inte tillgång till den. Kontrollera adressen eller gå tillbaka till kunderna.">
      <Button asChild>
        <Link href="/clients">Till kunderna</Link>
      </Button>
    </StateView>
  );
}
