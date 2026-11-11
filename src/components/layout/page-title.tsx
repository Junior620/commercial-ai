import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Boutons d'action alignés à droite (passent à la ligne sur mobile). */
  actions?: React.ReactNode;
  className?: string;
}

export function PageTitle({ title, description, icon: Icon, actions, className }: PageTitleProps) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3.5">
        {Icon ? (
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-gradient text-primary-foreground shadow-glow-primary">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-[15px]">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
