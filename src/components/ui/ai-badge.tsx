import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Marqueur discret d'un contenu produit par l'assistant (email rédigé, score calculé).
 * Volontairement sobre : l'IA est un outil, pas un argument de vente de l'interface.
 */
type AIBadgeSize = "xs" | "sm" | "md";

interface AIBadgeProps {
  label?: string;
  size?: AIBadgeSize;
  /** Conservé pour compatibilité ; les deux variantes ont désormais le même rendu. */
  variant?: "solid" | "soft";
  /** Conservé pour compatibilité ; aucune animation n'est jouée. */
  animated?: boolean;
  className?: string;
  title?: string;
}

const SIZE_CLASSES: Record<AIBadgeSize, { root: string; icon: string }> = {
  xs: { root: "h-5 gap-1 px-1.5 text-[11px]", icon: "h-3 w-3" },
  sm: { root: "h-6 gap-1 px-2 text-xs", icon: "h-3.5 w-3.5" },
  md: { root: "h-7 gap-1.5 px-2.5 text-xs", icon: "h-4 w-4" },
};

export function AIBadge({ label = "Assistant", size = "sm", className, title }: AIBadgeProps) {
  const sz = SIZE_CLASSES[size];
  return (
    <span
      title={title ?? "Contenu proposé par l'assistant de rédaction"}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-sun/40 bg-[linear-gradient(90deg,oklch(0.799_0.16_76.4/0.22),oklch(0.799_0.16_76.4/0.08))] font-medium text-sun-foreground shadow-[0_0_12px_-4px_oklch(0.799_0.16_76.4/0.6)] dark:text-sun",
        sz.root,
        className
      )}
    >
      <Sparkles className={sz.icon} aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

export default AIBadge;
