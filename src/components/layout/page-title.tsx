import { LucideIcon } from "lucide-react";

interface PageTitleProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PageTitle({ title, description, icon: Icon }: PageTitleProps) {
  return (
    <div className="mb-2 flex items-start gap-4">
      <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-gradient-to-b from-primary/15 to-primary/5 shadow-sm">
        <Icon className="h-5 w-5 text-primary drop-shadow-sm" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}
