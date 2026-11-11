import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** Affiche le nom à côté du monogramme. */
  withName?: boolean;
  /** Variante pour fond sombre (sidebar cacao). */
  inverted?: boolean;
  className?: string;
}

/** Monogramme SCPB (soleil + sillons) et nom du produit. */
export function BrandMark({ withName = true, inverted = false, className }: BrandMarkProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center",
          !inverted && "rounded-lg bg-card ring-1 ring-border"
        )}
      >
        <Image src="/brand/mark.png" alt="" width={28} height={28} className={cn("object-contain", inverted ? "h-9 w-9" : "h-7 w-7")} priority />
      </span>
      {withName ? (
        <span className="min-w-0 leading-tight">
          <span className={cn("block truncate font-heading text-[15px] font-semibold", inverted ? "text-[#F8F3EA]" : "text-foreground")}>
            SCPB Commercial
          </span>
          <span className={cn("block truncate text-xs", inverted ? "text-[#F8F3EA]/65" : "text-muted-foreground")}>
            Prospection filière cacao
          </span>
        </span>
      ) : (
        <span className="sr-only">SCPB Commercial</span>
      )}
    </span>
  );
}
