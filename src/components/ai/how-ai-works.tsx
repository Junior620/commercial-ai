"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AIBadge } from "@/components/ui/ai-badge";
import {
  Radar,
  Brain,
  PenLine,
  Send,
  Inbox,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Radar,
    title: "1. Detection",
    description:
      "L IA cible Google Maps, valide les sites web et extrait automatiquement emails et contacts.",
    color: "from-sky-500 to-cyan-500",
    tag: "Scraping + enrichissement",
  },
  {
    icon: Brain,
    title: "2. Scoring",
    description:
      "Chaque prospect recoit un score entre 0 et 100 base sur secteur, taille, signaux web et pertinence.",
    color: "from-violet-500 to-fuchsia-500",
    tag: "Qualification IA",
  },
  {
    icon: PenLine,
    title: "3. Redaction",
    description:
      "Claude rédige un email personnalisé dans la langue du prospect, avec le ton commercial choisi.",
    color: "from-indigo-500 to-violet-500",
    tag: "Generation GPT/Claude",
  },
  {
    icon: Send,
    title: "4. Envoi intelligent",
    description:
      "Les envois sont repartis dans le temps, relancés automatiquement selon la reponse obtenue.",
    color: "from-emerald-500 to-teal-500",
    tag: "Orchestration",
  },
  {
    icon: Inbox,
    title: "5. Analyse & reprise",
    description:
      "Les reponses sont classees (interesse, OOO, refus…) et l IA suggere la suite logique.",
    color: "from-amber-500 to-orange-500",
    tag: "Classification",
  },
] as const;

interface HowAIWorksProps {
  className?: string;
  compact?: boolean;
}

export function HowAIWorks({ className, compact }: HowAIWorksProps) {
  return (
    <Card
      className={cn(
        "border-violet-200/70 bg-gradient-to-br from-violet-50/60 via-background to-indigo-50/60 dark:border-violet-900/40 dark:from-violet-950/30 dark:via-background dark:to-indigo-950/30",
        className
      )}
    >
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Workflow className="h-4 w-4 text-violet-500" />
            Comment l&apos;IA travaille ici
          </CardTitle>
          <CardDescription>
            Un pipeline intelligent de la detection du prospect jusqu au suivi de la reponse
          </CardDescription>
        </div>
        <AIBadge label="Pipeline IA" size="xs" variant="solid" animated />
      </CardHeader>
      <CardContent>
        <ol
          className={cn(
            "grid gap-3",
            compact
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
          )}
        >
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/80 p-3 shadow-sm backdrop-blur transition-colors hover:border-violet-300/80 dark:hover:border-violet-700/60"
              >
                <div
                  className={cn(
                    "mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-md",
                    step.color
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="break-words text-sm font-semibold leading-tight">
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
                <span className="mt-2 inline-flex max-w-full items-center rounded-full border border-violet-200/60 bg-violet-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
                  {step.tag}
                </span>
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-violet-400/0 blur-2xl transition-all group-hover:bg-violet-400/20"
                />
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export default HowAIWorks;
