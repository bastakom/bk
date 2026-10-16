"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", label: "Team och roller" },
  { href: "/settings/brand", label: "Varumärke" },
  { href: "/settings/metrics", label: "Egna metrics" },
  { href: "/settings/sync", label: "Synk och larm" },
  { href: "/design-system", label: "Designsystem" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Inställningar" className="mb-8 flex gap-1 overflow-x-auto border-b">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={pathname === t.href ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pathname === t.href ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
