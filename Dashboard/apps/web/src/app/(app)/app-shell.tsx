"use client";

import type { Role } from "@rp/db";
import { Bell, Check, ChevronsUpDown, Database, LayoutDashboard, LayoutTemplate, LogOut, Mail, Menu, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Sun, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { initials, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NavClient, NavDashboard, Notice, OnboardingStep } from "./shell-data";
import { switchWorkspace } from "./workspace-actions";

const NAV = [
  { href: "/clients", label: "Kunder", icon: Users, count: "clients" },
  { href: "/dashboards", label: "Dashboards", icon: LayoutDashboard, count: "dashboards" },
  { href: "/databases", label: "Databaser", icon: Database },
  { href: "/templates", label: "Mallar", icon: LayoutTemplate },
  { href: "/reports", label: "Utskick", icon: Mail, count: "schedules" },
] as const;
const SETTINGS = { href: "/settings", label: "Inställningar", icon: Settings };

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", EDITOR: "Redaktör", VIEWER: "Läsare", CLIENT: "Kund" };
export const SIDEBAR_COOKIE = "rp_sidebar";

interface ShellProps {
  user: { name: string; email: string };
  workspace: { id: string; name: string };
  workspaces: { id: string; name: string }[];
  role: Role;
  clients: NavClient[];
  dashboards: NavDashboard[];
  notices: Notice[];
  counts: { clients: number; dashboards: number; schedules: number };
  onboarding: OnboardingStep[];
  collapsed: boolean;
  children: React.ReactNode;
}

/** Appens ram: sidomeny (kan fällas ihop), toppfält med brödsmulor och sök, och kommandopalett (⌘K). */
export function AppShell(props: ShellProps) {
  const [collapsed, setCollapsed] = useState(props.collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toggle = () => {
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${c ? "open" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <a href="#main" className="sr-only z-50 rounded-md bg-card px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Hoppa till innehållet
      </a>
      <div className="flex min-h-svh">
        <aside className={cn("sticky top-0 hidden h-svh shrink-0 flex-col bg-gradient-to-b from-sidebar to-[#0e192d] text-sidebar-foreground transition-[width] duration-200 md:flex dark:to-[#070c17]", collapsed ? "w-[68px]" : "w-[248px]")}>
          <SidebarBody {...props} collapsed={collapsed} onToggle={toggle} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card/75 px-3 backdrop-blur md:px-8">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Öppna meny">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-64 flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground" onClick={(e) => (e.target as HTMLElement).closest("a") && setMobileOpen(false)}>
                <SheetTitle className="sr-only">Meny</SheetTitle>
                <SidebarBody {...props} collapsed={false} />
              </SheetContent>
            </Sheet>
            <Breadcrumbs clients={props.clients} dashboards={props.dashboards} />
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" onClick={() => setPaletteOpen(true)} className="h-10 gap-2.5 rounded-[11px] border border-border bg-card px-3 font-normal text-muted-foreground shadow-none hover:text-foreground max-sm:size-10 max-sm:px-0 lg:w-80 lg:justify-start" aria-label="Sök (⌘K)">
                <Search className="size-4" aria-hidden />
                <span className="hidden lg:inline">Sök kunder, rapporter …</span>
                <span className="ml-auto hidden gap-0.5 lg:flex" aria-hidden>
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </span>
              </Button>
              <Notifications notices={props.notices} />
              <UserMenu user={props.user} />
            </div>
          </header>
          <main id="main" className="min-w-0 flex-1">
            {props.children}
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} clients={props.clients} dashboards={props.dashboards} role={props.role} />
    </TooltipProvider>
  );
}

/* ─── Sidomeny ───────────────────────────────────────────────────────────── */

function SidebarBody(props: ShellProps & { collapsed: boolean; onToggle?: () => void }) {
  const pathname = usePathname();
  const { collapsed } = props;
  const item = (it: { href: string; label: string; icon: typeof Users; count?: keyof ShellProps["counts"] }) => {
    const n = it.count ? props.counts[it.count] : 0;
    const active = pathname === it.href || pathname.startsWith(`${it.href}/`) || (it.href === "/settings" && pathname.startsWith("/design-system"));
    const link = (
      <Link
        key={it.href}
        href={it.href}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? it.label : undefined}
        className={cn(
          "flex h-10 items-center gap-3 rounded-[10px] text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          collapsed ? "justify-center" : "px-2.5",
          active ? "bg-sidebar-primary font-bold text-sidebar-primary-foreground shadow-lift" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
        )}
      >
        <it.icon className="size-[18px] shrink-0" aria-hidden />
        {!collapsed && it.label}
        {!collapsed && n > 0 && (
          <span className={cn("tabular ml-auto rounded-full px-1.5 text-[11px] font-bold", active ? "bg-primary text-primary-foreground dark:bg-[#13213a] dark:text-white" : "bg-white/12 text-sidebar-foreground")}>{n}</span>
        )}
      </Link>
    );
    return collapsed ? (
      <Tooltip key={it.href}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{it.label}</TooltipContent>
      </Tooltip>
    ) : (
      link
    );
  };

  return (
    <>
      <div className={cn("flex h-16 items-center", collapsed ? "justify-center" : "px-5")}>
        {collapsed ? <span className="text-lg font-bold text-white">BK</span> : <Logo inverted />}
      </div>
      <div className={cn(collapsed ? "px-2.5" : "px-3")}>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn("flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent text-left text-sm outline-none hover:bg-white/12 focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed ? "justify-center p-2" : "p-2.5")}
            aria-label={`Byrå: ${props.workspace.name}`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[#e8edf5] text-[11px] font-extrabold text-[#13213a]">{initials(props.workspace.name)}</span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-white">{props.workspace.name}</span>
                  <span className="block text-xs text-sidebar-foreground/70">{ROLE_LABEL[props.role]}</span>
                </span>
                <ChevronsUpDown className="size-3.5 text-sidebar-foreground/70" aria-hidden />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Byråer</DropdownMenuLabel>
            {props.workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onClick={() => switchWorkspace(w.id)}>
                {w.name}
                {w.id === props.workspace.id && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <nav className={cn("mt-6 flex-1 space-y-0.5", collapsed ? "px-2.5" : "px-3.5")} aria-label="Huvudmeny">
        {!collapsed && <p className="px-2.5 pb-2 text-[10.5px] font-bold tracking-[0.12em] text-sidebar-foreground/60 uppercase">Arbeta</p>}
        {NAV.map(item)}
      </nav>
      <div className={cn("space-y-1 py-3", collapsed ? "px-2.5" : "px-3.5")}>
        {item(SETTINGS)}
        {!collapsed && <Onboarding steps={props.onboarding} />}
        {props.onToggle && (
          <button
            type="button"
            onClick={props.onToggle}
            aria-label={collapsed ? "Fäll ut menyn" : "Fäll ihop menyn"}
            className={cn("flex h-10 w-full items-center gap-3 rounded-xl text-sm text-sidebar-foreground/70 outline-none hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring", collapsed ? "justify-center" : "px-3")}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
            {!collapsed && "Fäll ihop"}
          </button>
        )}
      </div>
    </>
  );
}

/** Kom igång-lista för nya byråer. Försvinner när alla steg är klara. */
function Onboarding({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  return (
    <section aria-label="Kom igång" className="mt-3 rounded-2xl border border-sidebar-border bg-sidebar-accent p-3.5 text-[12.5px]">
      <p className="font-bold text-white">Kom igång</p>
      <p className="mt-0.5 text-sidebar-foreground/80">
        {done} av {steps.length} steg klara
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/12" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Kom igång">
        <div className="h-full rounded-full bg-white" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border text-[9px]", s.done ? "border-white bg-white text-[#13213a]" : "border-white/40")} aria-hidden>
              {s.done && <Check className="size-2.5" strokeWidth={3} />}
            </span>
            {s === next ? (
              <Link href={s.href} className="font-semibold text-white underline-offset-2 hover:underline">
                {s.label}
              </Link>
            ) : (
              <span className={cn(s.done && "text-sidebar-foreground/60 line-through")}>{s.label}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─── Brödsmulor med sökbara väljare ─────────────────────────────────────── */

const SECTION_LABEL: Record<string, string> = {
  clients: "Kunder",
  dashboards: "Dashboards",
  databases: "Databaser",
  templates: "Mallar",
  reports: "Utskick",
  settings: "Inställningar",
  "design-system": "Designsystem",
  apply: "Använd mall",
  "no-access": "Ingen behörighet",
};
const SETTINGS_LABEL: Record<string, string> = { brand: "Varumärke", metrics: "Egna metrics", sync: "Synk och larm" };

function Breadcrumbs({ clients, dashboards }: { clients: NavClient[]; dashboards: NavDashboard[] }) {
  const parts = usePathname().split("/").filter(Boolean);
  const [section, clientSlug, sub, dashboardId] = parts;
  const client = section === "clients" && clientSlug ? clients.find((c) => c.slug === clientSlug) : undefined;
  const dashboard = sub === "dashboards" && dashboardId ? dashboards.find((d) => d.id === dashboardId) : undefined;
  const crumbs: React.ReactNode[] = [];

  if (section === "design-system") crumbs.push(<Crumb key="s" href="/settings" label="Inställningar" />, <Crumb key="d" label="Designsystem" current />);
  else if (section === "settings") {
    crumbs.push(<Crumb key="s" href="/settings" label="Inställningar" current={!clientSlug} />);
    if (clientSlug) crumbs.push(<Crumb key="t" label={SETTINGS_LABEL[clientSlug] ?? clientSlug} current />);
  } else if (section) {
    crumbs.push(<Crumb key="s" href={`/${section}`} label={SECTION_LABEL[section] ?? section} current={!client} />);
    if (client) {
      crumbs.push(
        <Switcher
          key="c"
          label={client.name}
          current={!dashboard}
          searchLabel="Byt kund"
          dot={client.color}
          items={clients.map((c) => ({ id: c.slug, label: c.name, href: `/clients/${c.slug}`, dot: c.color }))}
          selected={client.slug}
          href={`/clients/${client.slug}`}
        />,
      );
      if (dashboard) {
        crumbs.push(
          <Switcher
            key="d"
            label={dashboard.name}
            current
            searchLabel="Byt dashboard"
            items={dashboards.filter((d) => d.clientSlug === client.slug).map((d) => ({ id: d.id, label: d.name, href: `/clients/${d.clientSlug}/dashboards/${d.id}` }))}
            selected={dashboard.id}
          />,
        );
      }
    }
  }

  return (
    <nav aria-label="Brödsmulor" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && (
              <span className="text-muted-foreground/60" aria-hidden>
                /
              </span>
            )}
            {c}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Crumb({ href, label, current }: { href?: string; label: string; current?: boolean }) {
  if (current || !href)
    return (
      <span aria-current={current ? "page" : undefined} className="truncate font-semibold text-heading">
        {label}
      </span>
    );
  return (
    <Link href={href} className="truncate rounded px-1 text-muted-foreground hover:text-foreground">
      {label}
    </Link>
  );
}

function Switcher(p: { label: string; current?: boolean; searchLabel: string; dot?: string; items: { id: string; label: string; href: string; dot?: string }[]; selected: string; href?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <span className="flex min-w-0 items-center">
      {p.href && !p.current ? (
        <Link href={p.href} className="flex min-w-0 items-center gap-1.5 truncate rounded px-1 text-muted-foreground hover:text-foreground">
          {p.dot && <span className="size-2 shrink-0 rounded-full" style={{ background: p.dot }} aria-hidden />}
          <span className="truncate">{p.label}</span>
        </Link>
      ) : (
        <span aria-current="page" className="flex min-w-0 items-center gap-1.5 truncate px-1 font-semibold text-heading">
          {p.dot && <span className="size-2 shrink-0 rounded-full" style={{ background: p.dot }} aria-hidden />}
          <span className="truncate">{p.label}</span>
        </span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={p.searchLabel} className="text-muted-foreground">
            <ChevronsUpDown aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <CommandListInline
            placeholder={`${p.searchLabel} …`}
            items={p.items}
            selected={p.selected}
            onPick={(href) => {
              setOpen(false);
              router.push(href);
            }}
          />
        </PopoverContent>
      </Popover>
    </span>
  );
}

function CommandListInline({ placeholder, items, selected, onPick }: { placeholder: string; items: { id: string; label: string; href: string; dot?: string }[]; selected: string; onPick: (href: string) => void }) {
  const [q, setQ] = useState("");
  const list = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-10 border-b bg-transparent px-3 text-sm outline-none" onKeyDown={(e) => e.key === "Enter" && list[0] && onPick(list[0].href)} />
      <ul className="max-h-72 overflow-y-auto p-1" role="listbox" aria-label={placeholder}>
        {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Inga träffar.</li>}
        {list.map((i) => (
          <li key={i.id} role="option" aria-selected={i.id === selected}>
            <button type="button" onClick={() => onPick(i.href)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
              {i.dot && <span className="size-2 shrink-0 rounded-full" style={{ background: i.dot }} aria-hidden />}
              <span className="truncate">{i.label}</span>
              {i.id === selected && <Check className="ml-auto size-4" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ─── Notiser och användarmeny ───────────────────────────────────────────── */

function Notifications({ notices }: { notices: Notice[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-10 rounded-[11px] shadow-none" aria-label={notices.length ? `Notiser, ${notices.length} att åtgärda` : "Notiser"}>
          <Bell className="size-[18px]" aria-hidden />
          {notices.length > 0 && <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">{notices.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold">Notiser</p>
        {notices.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Allt fungerar. Inga synkfel eller misslyckade utskick.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {notices.map((n) => (
              <li key={n.id}>
                <Link href={n.href} className="block px-4 py-3 hover:bg-muted/50">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className={cn("size-2 shrink-0 rounded-full", n.tone === "danger" ? "bg-destructive" : "bg-warning")} aria-hidden />
                    {n.title}
                  </span>
                  {n.text && <span className="mt-0.5 block text-xs text-muted-foreground">{n.text}</span>}
                  <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(new Date(n.at))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function UserMenu({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Konto: ${user.name}`}>
        <Avatar className="size-10">
          <AvatarFallback className="bg-primary text-[13px] font-bold text-primary-foreground">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Tema</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun /> Ljust
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon /> Mörkt
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor /> Som datorn
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.push("/sign-in");
            router.refresh();
          }}
        >
          <LogOut /> Logga ut
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Kommandopalett ─────────────────────────────────────────────────────── */

function CommandPalette({ open, onOpenChange, clients, dashboards, role }: { open: boolean; onOpenChange: (o: boolean) => void; clients: NavClient[]; dashboards: NavDashboard[]; role: Role }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
      <CommandInput placeholder="Sök kund, dashboard eller åtgärd …" />
      <CommandList>
        <CommandEmpty>Inga träffar.</CommandEmpty>
        <CommandGroup heading="Åtgärder">
          {role !== "VIEWER" && (
            <CommandItem onSelect={() => go("/clients?ny=1")}>
              <Plus /> Ny kund
            </CommandItem>
          )}
          {role === "ADMIN" && (
            <CommandItem onSelect={() => go("/databases?koppla=1")}>
              <Database /> Koppla källa
            </CommandItem>
          )}
          <CommandItem onSelect={() => (setTheme("dark"), onOpenChange(false))}>
            <Moon /> Mörkt tema
          </CommandItem>
          <CommandItem onSelect={() => (setTheme("light"), onOpenChange(false))}>
            <Sun /> Ljust tema
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Kunder">
          {clients.map((c) => (
            <CommandItem key={c.id} value={`kund ${c.name}`} onSelect={() => go(`/clients/${c.slug}`)}>
              <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
              {c.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Dashboards">
          {dashboards.slice(0, 200).map((d) => (
            <CommandItem key={d.id} value={`dashboard ${d.name} ${d.clientName}`} onSelect={() => go(`/clients/${d.clientSlug}/dashboards/${d.id}`)}>
              <LayoutDashboard />
              <span className="truncate">{d.name}</span>
              <CommandShortcut>{d.clientName}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Gå till">
          {[...NAV, SETTINGS].map((n) => (
            <CommandItem key={n.href} value={`sida ${n.label}`} onSelect={() => go(n.href)}>
              <n.icon /> {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
