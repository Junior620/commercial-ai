"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Badge reutilisable qui signale qu un element est genere ou optimise par l IA.
 * Deux variantes :
 *  - solid (par defaut) : pastille degradee violet/indigo avec micro-animation
 *  - soft : version plus discrete avec fond translucide
 */
type AIBadgeSize = "xs" | "sm" | "md";
type AIBadgeVariant = "solid" | "soft";

interface AIBadgeProps {
  label?: string;
  size?: AIBadgeSize;
  variant?: AIBadgeVariant;
  animated?: boolean;
  className?: string;
  title?: string;
}

const SIZE_CLASSES: Record<
  AIBadgeSize,
  { root: string; icon: string }
> = {
  xs: { root: "h-5 px-1.5 gap-1 text-[10px]", icon: "h-3 w-3" },
  sm: { root: "h-6 px-2 gap-1 text-[11px]", icon: "h-3.5 w-3.5" },
  md: { root: "h-7 px-2.5 gap-1.5 text-xs", icon: "h-4 w-4" },
};

const VARIANT_CLASSES: Record<AIBadgeVariant, string> = {
  solid:
    "border-violet-400/40 bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500 text-white shadow-sm",
  soft:
    "border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200",
};

export function AIBadge({
  label = "IA",
  size = "sm",
  variant = "soft",
  animated = true,
  className,
  title,
}: AIBadgeProps) {
  const sz = SIZE_CLASSES[size];
  return (
    <span
      title={title ?? "Propulse par IA"}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border font-semibold uppercase tracking-wide",
        VARIANT_CLASSES[variant],
        sz.root,
        className
      )}
    >
      <Sparkles
        className={cn(sz.icon, animated && "animate-pulse")}
        aria-hidden
      />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

export default AIBadge;
