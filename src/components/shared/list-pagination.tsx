"use client";

import { Button } from "@/components/ui/button";

interface ListPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (nextPage: number) => void;
}

export function ListPagination({
  page,
  totalPages,
  totalItems,
  itemLabel,
  onPageChange,
}: ListPaginationProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-muted-foreground">
        Page {page} / {totalPages} - {totalItems} {itemLabel}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Precedent
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
