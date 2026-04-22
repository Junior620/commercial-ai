"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Layers,
  Mail,
  Search,
  Settings,
  Send,
  MessageSquare,
  Bot,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AIBadge } from "@/components/ui/ai-badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navigation: Array<{
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  aiTag?: boolean;
}> = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Prospects", href: "/prospects", icon: Users, aiTag: true },
  { name: "Segments", href: "/segments", icon: Layers },
  { name: "Scraping", href: "/scraping", icon: Search, aiTag: true },
  { name: "Campagnes", href: "/campaigns", icon: Mail, aiTag: true },
  { name: "Envoi", href: "/sending", icon: Send },
  { name: "Reponses", href: "/responses", icon: MessageSquare },
  { name: "Agent IA", href: "/ai", icon: Bot, aiTag: true },
  { name: "Parametres", href: "/settings", icon: Settings },
];

type SidebarProps = {
  className?: string;
};

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 p-2">
      {navigation.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            title={collapsed ? item.name : undefined}
            onClick={onNavigate}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <span className="flex flex-1 items-center justify-between gap-2">
                <span className="truncate">{item.name}</span>
                {item.aiTag && !isActive ? (
                  <span
                    title="Propulse par IA"
                    className="inline-flex h-4 items-center gap-0.5 rounded-full border border-violet-200/70 bg-violet-50 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200"
                  >
                    IA
                  </span>
                ) : null}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-background/90 backdrop-blur transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border bg-background">
            <Image
              src="/logo.png"
              alt="Logo SCPB Commercial AI"
              width={32}
              height={32}
              className="h-full w-full object-contain p-0.5"
              priority
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-sm font-semibold">
                  SCPB Commercial AI
                </h1>
                <AIBadge label="IA" size="xs" variant="solid" animated />
              </div>
              <p className="text-[10px] text-muted-foreground">
                SCPB · Intelligence Commerciale
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <SidebarNav collapsed={collapsed} />

      <div className="border-t p-4">
        {!collapsed && (
          <p className="text-xs text-muted-foreground text-center">
            v1.0 — Avril 2026
          </p>
        )}
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full md:hidden"
            aria-label="Ouvrir le menu"
          />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[82vw] max-w-xs p-0">
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border bg-background">
            <Image
              src="/logo.png"
              alt="Logo SCPB Commercial AI"
              width={32}
              height={32}
              className="h-full w-full object-contain p-0.5"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-semibold">SCPB Commercial AI</h1>
              <AIBadge label="IA" size="xs" variant="solid" animated />
            </div>
            <p className="text-[10px] text-muted-foreground">
              SCPB · Intelligence Commerciale
            </p>
          </div>
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
