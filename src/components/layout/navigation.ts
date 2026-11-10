import {
  Bot,
  LayoutDashboard,
  Layers,
  Mail,
  MessageSquare,
  Search,
  Send,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { name: string; href: string; icon: LucideIcon; description: string };
export type NavSection = { label: string; items: NavItem[] };

/** Navigation principale : les libellés sont repris tels quels comme titres de page. */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Pilotage",
    items: [{ name: "Tableau de bord", href: "/", icon: LayoutDashboard, description: "Vue d'ensemble de l'activité" }],
  },
  {
    label: "Prospection",
    items: [
      { name: "Prospects", href: "/prospects", icon: Users, description: "Base de prospects qualifiés" },
      { name: "Segments", href: "/segments", icon: Layers, description: "Groupes de ciblage" },
      { name: "Recherche de prospects", href: "/scraping", icon: Search, description: "Collecte via Google Maps et sites web" },
    ],
  },
  {
    label: "Campagnes",
    items: [
      { name: "Campagnes", href: "/campaigns", icon: Mail, description: "Rédaction, relecture et suivi" },
      { name: "Envoi", href: "/sending", icon: Send, description: "Cadence et délivrabilité" },
      { name: "Réponses", href: "/responses", icon: MessageSquare, description: "Réponses des prospects" },
    ],
  },
  {
    label: "Outils",
    items: [
      { name: "Assistant de rédaction", href: "/ai", icon: Bot, description: "Rédiger un email ponctuel" },
      { name: "Paramètres", href: "/settings", icon: Settings, description: "Envoi, signature et équipe" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) || (href !== "/" && pathname === href);
}
