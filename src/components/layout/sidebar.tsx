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
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Prospects", href: "/prospects", icon: Users },
  { name: "Segments", href: "/segments", icon: Layers },
  { name: "Scraping", href: "/scraping", icon: Search },
  { name: "Campagnes", href: "/campaigns", icon: Mail },
  { name: "Envoi", href: "/sending", icon: Send },
  { name: "Reponses", href: "/responses", icon: MessageSquare },
  { name: "Agent IA", href: "/ai", icon: Bot },
  { name: "Parametres", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-background/90 backdrop-blur transition-all duration-300",
        collapsed ? "w-16" : "w-64"
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
            <div>
              <h1 className="text-sm font-semibold">SCPB Commercial AI</h1>
              <p className="text-[10px] text-muted-foreground">
                SCPB - Intelligence Commerciale
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
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

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
