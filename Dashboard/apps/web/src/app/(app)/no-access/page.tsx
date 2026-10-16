import { Lock } from "lucide-react";
import Link from "next/link";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ingen behörighet" };

export default function NoAccessPage() {
  return (
    <StateView icon={<Lock />} title="Du saknar behörighet" text="Den här sidan kräver en annan roll. Be en admin på byrån om ändrad roll under Inställningar → Team och roller.">
      <Button asChild variant="outline">
        <Link href="/clients">Till kunderna</Link>
      </Button>
    </StateView>
  );
}
