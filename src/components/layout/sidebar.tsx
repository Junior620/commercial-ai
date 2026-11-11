"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "@/components/brand/brand-mark";
import { NAV_SECTIONS, isActivePath } from "@/components/layout/navigation";

const COLLAPSE_KEY = "scpb.sidebar.collapsed";

function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-5 last:mb-0">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" aria-hidden />
          ) : (
            <p className="mb-1.5 px-3 text-xs font-medium tracking-wide text-sidebar-foreground/55">{section.label}</p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-[linear-gradient(90deg,oklch(0.799_0.16_76.4/0.16),oklch(0.799_0.16_76.4/0.03))] text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_oklch(0.799_0.16_76.4/0.18)]"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {active ? (
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-sidebar-primary shadow-[0_0_10px_1px_oklch(0.799_0.16_76.4/0.7)]" aria-hidden />
                    ) : null}
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-sidebar-primary drop-shadow-[0_0_6px_oklch(0.799_0.16_76.4/0.6)]")} />
                    {collapsed ? <span className="sr-only">{item.name}</span> : <span className="truncate">{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar bg-[linear-gradient(180deg,oklch(0.31_0.06_120)_0%,oklch(0.25_0.05_122)_100%)] text-sidebar-foreground transition-[width] duration-200 dark:bg-[linear-gradient(180deg,oklch(0.2_0.035_120)_0%,oklch(0.15_0.025_122)_100%)]",
        collapsed ? "w-[72px]" : "w-64",
        className
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href="/" className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <BrandMark inverted withName={!collapsed} />
        </Link>
      </div>

      <SidebarNav collapsed={collapsed} />

      <div className={cn("border-t border-sidebar-border p-3", collapsed && "flex justify-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={toggle}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          aria-expanded={!collapsed}
          className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              Replier
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Ouvrir le menu" />}>
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[82vw] max-w-xs border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <BrandMark inverted />
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
