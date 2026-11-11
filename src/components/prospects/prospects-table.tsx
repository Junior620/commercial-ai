"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { countryName, scoreTone, type Prospect } from "@/components/prospects/types";
import { FitBadge, NeedChips } from "@/components/prospects/fit-badge";

export type SortKey = "createdAt" | "company" | "score" | "country" | "status";

interface TableProps {
  rows: Prospect[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  selectedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: () => void;
  onOpen: (p: Prospect) => void;
  onEdit: (p: Prospect) => void;
  onDelete: (p: Prospect) => void;
}

function SortButton({ label, col, sortKey, sortDir, onSort }: { label: string; col: SortKey } & Pick<TableProps, "sortKey" | "sortDir" | "onSort">) {
  const active = sortKey === col;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className="inline-flex items-center gap-1 rounded font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Trier par ${label.toLowerCase()}`}
    >
      {label}
      <Icon className={cn("h-3.5 w-3.5", active ? "opacity-80" : "opacity-40")} aria-hidden />
    </button>
  );
}

function RowActions({ p, onEdit, onDelete }: { p: Prospect } & Pick<TableProps, "onEdit" | "onDelete">) {
  return (
    <div className="flex justify-end gap-0.5">
      <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${p.company}`} onClick={(e) => (e.stopPropagation(), onEdit(p))}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:text-destructive"
        aria-label={`Supprimer ${p.company}`}
        onClick={(e) => (e.stopPropagation(), onDelete(p))}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Tableau (bureau) et liste de cartes (mobile) des prospects. */
export function ProspectsTable(props: TableProps) {
  const { rows, selectedIds, onToggle, onToggleAll, onOpen } = props;
  const allSelected = rows.length > 0 && rows.every((p) => selectedIds.has(p.id));
  const sortProps = { sortKey: props.sortKey, sortDir: props.sortDir, onSort: props.onSort };

  return (
    <>
      <ul className="space-y-2 md:hidden" aria-label="Prospects">
        {rows.map((p) => (
          <li key={p.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-3">
              <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={(v) => onToggle(p.id, v === true)} aria-label={`Sélectionner ${p.company}`} className="mt-1" />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(p)}>
                <p className="truncate font-medium">{p.company}</p>
                <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge kind="prospect" value={p.status} />
                  <FitBadge fit={p.targetFit} />
                  <span className="text-xs text-muted-foreground">{countryName(p.country)}</span>
                  <span className={cn("text-xs font-semibold", scoreTone(p.score))}>Score {p.score}</span>
                </div>
              </button>
              <RowActions p={p} onEdit={props.onEdit} onDelete={props.onDelete} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table className="min-w-[1000px]">
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pr-0">
                <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Sélectionner les prospects de la page" />
              </TableHead>
              <TableHead>
                <SortButton label="Entreprise" col="company" {...sortProps} />
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>
                <SortButton label="Pays" col="country" {...sortProps} />
              </TableHead>
              <TableHead className="max-w-[14rem]">Activité</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>
                <SortButton label="Score" col="score" {...sortProps} />
              </TableHead>
              <TableHead>
                <SortButton label="Statut" col="status" {...sortProps} />
              </TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpen(p)}>
                <TableCell className="pr-0" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={(v) => onToggle(p.id, v === true)} aria-label={`Sélectionner ${p.company}`} />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="rounded text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(e) => (e.stopPropagation(), onOpen(p))}
                  >
                    {p.company}
                  </button>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </TableCell>
                <TableCell className="text-sm">{p.contact?.trim() || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm">{countryName(p.country)}</TableCell>
                <TableCell className="max-w-[14rem] text-sm" title={p.sector ?? undefined}>
                  <span className="block truncate">{p.sector || "—"}</span>
                  <NeedChips needs={p.productNeeds} />
                </TableCell>
                <TableCell>
                  <FitBadge fit={p.targetFit} />
                </TableCell>
                <TableCell>
                  <span className={cn("font-semibold", scoreTone(p.score))}>{p.score}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge kind="prospect" value={p.status} />
                </TableCell>
                <TableCell>
                  <StatusBadge kind="priority" value={p.priority} />
                </TableCell>
                <TableCell className="text-right">
                  <RowActions p={p} onEdit={props.onEdit} onDelete={props.onDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
