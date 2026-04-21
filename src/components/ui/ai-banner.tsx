"use client";

import { Brain, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";

/**
 * Bandeau "Assistant IA actif" pour rappeler visuellement que la plateforme
 * fonctionne avec une IA en continu (scoring, generation d emails, priorisation).
 */
interface AIBannerProps {
  className?: string;
  title?: string;
  description?: string;
  stats?: Array<{
    icon?: "brain" | "sparkles" | "zap";
    label: string;
    /**
     * - Si value est un nombre, on anime avec CountUp.
     * - Si c est une string, on l affiche telle quelle (ex. "12%").
     */
    value: string | number;
    suffix?: string;
  }>;
}

const ICONS = {
  brain: Brain,
  sparkles: Sparkles,
  zap: Zap,
};

export function AIBanner({
  className,
  title = "Assistant IA actif",
  description = "Le scoring, le ciblage et la redaction des emails sont optimises en continu par l IA.",
  stats,
}: AIBannerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 shadow-sm dark:border-violet-900/40 dark:from-violet-950/40 dark:via-background dark:to-indigo-950/30",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10"
      />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-fuchsia-500 text-white shadow-md">
            <Brain className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-background" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground md:text-base">
                {title}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/60 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-200">
                <Sparkles className="h-3 w-3 animate-pulse" />
                Propulse par IA
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground md:text-sm">
              {description}
            </p>
          </div>
        </div>

        {stats && stats.length > 0 && (
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {stats.map((s) => {
              const Icon = ICONS[s.icon ?? "sparkles"];
              return (
                <div
                  key={s.label}
                  className="rounded-lg border border-violet-200/60 bg-white/70 px-3 py-2 text-center shadow-sm backdrop-blur dark:border-violet-900/50 dark:bg-background/60"
                >
                  <Icon className="mx-auto h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {typeof s.value === "number" ? (
                      <CountUp value={s.value} suffix={s.suffix ?? ""} />
                    ) : (
                      s.value
                    )}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AIBanner;
