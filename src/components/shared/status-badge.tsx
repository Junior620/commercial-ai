import { cn } from "@/lib/utils";
import { STATUS_TONES, TONE_CLASSES, statusLabel, type LabelKind, type Tone } from "@/lib/labels";

interface StatusBadgeProps {
  kind: LabelKind;
  value: string | null | undefined;
  tone?: Tone;
  className?: string;
}

/** Pastille de statut traduite et colorée selon la charte. */
export function StatusBadge({ kind, value, tone, className }: StatusBadgeProps) {
  const resolved = tone ?? (value ? STATUS_TONES[value] : undefined) ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
        TONE_CLASSES[resolved],
        className
      )}
    >
      {statusLabel(kind, value)}
    </span>
  );
}
