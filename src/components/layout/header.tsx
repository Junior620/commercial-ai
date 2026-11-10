"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Moon, Search, Settings, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";
import { MobileSidebar } from "@/components/layout/sidebar";
import { NAV_ITEMS } from "@/components/layout/navigation";

export type HeaderUser = { name: string | null; email: string; role: string };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  COMMERCIAL: "Commercial",
  ASSISTANT: "Assistant",
  DIRECTION: "Direction (lecture)",
};

function initials(user: HeaderUser): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

type ProspectHit = { id: string; company: string; email: string; country: string };

function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProspectHit[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/prospects?search=${encodeURIComponent(query.trim())}&limit=8`, {
          signal: controller.signal,
        });
        if (res.ok) setHits(await res.json());
      } catch {
        /* requête annulée */
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-72 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Rechercher un prospect, une page…</span>
        <kbd className="rounded border bg-muted px-1.5 font-mono text-[11px]">Ctrl K</kbd>
      </button>
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Rechercher" onClick={() => setOpen(true)}>
        <Search className="h-5 w-5" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Recherche"
        description="Rechercher un prospect ou une page"
      >
        <CommandInput placeholder="Entreprise, email, page…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          {hits.length > 0 ? (
            <CommandGroup heading="Prospects">
              {hits.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.company} ${p.email}`}
                  onSelect={() => go(`/prospects?search=${encodeURIComponent(p.email)}`)}
                >
                  <span className="truncate font-medium">{p.company}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{p.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          <CommandGroup heading="Pages">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.href} value={`${item.name} ${item.description}`} onSelect={() => go(item.href)}>
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{item.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export function Header({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-background/85 px-3 backdrop-blur sm:px-4 md:px-6">
      <div className="flex items-center gap-2">
        <MobileSidebar />
        <SearchPalette />
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Menu du compte"
            className="flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:rounded-md sm:pr-2"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials(user)}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-sm font-medium sm:block">{user.name || user.email}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-sm font-medium text-foreground">{user.name || user.email}</span>
                {user.name ? <span className="block truncate text-xs text-muted-foreground">{user.email}</span> : null}
                <span className="mt-1 block text-xs text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
