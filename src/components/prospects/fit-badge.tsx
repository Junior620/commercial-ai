import { cn } from "@/lib/utils";
import { FIT_CLASSES, FIT_LABELS, NEED_LABELS } from "@/components/prospects/types";

export function FitBadge({ fit, className }: { fit?: string | null; className?: string }) {
  if (!fit) return null;
  return (
    <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-medium", FIT_CLASSES[fit], className)}>
      {FIT_LABELS[fit] ?? fit}
    </span>
  );
}

export function NeedChips({ needs }: { needs?: string[] | null }) {
  if (!needs?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {needs.map((n) => (
        <span key={n} className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[11px] font-medium text-primary">
          {NEED_LABELS[n] ?? n}
        </span>
      ))}
    </span>
  );
}
