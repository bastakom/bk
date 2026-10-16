"use client";

import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Tunn list överst i kundportalen: tillbaka till rapportlistan och logga ut. */
export function PortalBar({ user, agency, en, staff }: { user: string; agency: string; en: boolean; staff: boolean }) {
  const router = useRouter();
  const onList = usePathname() === "/portal";
  return (
    <div className="border-b bg-muted/40 text-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-1.5 md:px-8">
        {onList ? (
          <span className="text-muted-foreground">{staff ? (en ? "Client portal (preview)" : "Kundportal (förhandsvisning)") : agency}</span>
        ) : (
          <Link href="/portal" className="inline-flex items-center gap-1.5 font-medium hover:underline">
            <ArrowLeft className="size-3.5" aria-hidden /> {en ? "All reports" : "Alla rapporter"}
          </Link>
        )}
        <div className="flex items-center gap-2">
          {staff && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/clients">Till appen</Link>
            </Button>
          )}
          <span className="hidden text-muted-foreground sm:inline">{user}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await authClient.signOut();
              router.push("/sign-in");
              router.refresh();
            }}
          >
            <LogOut /> {en ? "Sign out" : "Logga ut"}
          </Button>
        </div>
      </div>
    </div>
  );
}
