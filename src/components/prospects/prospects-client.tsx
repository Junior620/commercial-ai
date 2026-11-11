"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FilterX, Loader2, Plus, Search, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageTitle } from "@/components/layout/page-title";
import { ListPagination } from "@/components/shared/list-pagination";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { PRIORITY_LABELS, PROSPECT_STATUS_LABELS } from "@/lib/labels";
import { ProspectFormDialog } from "@/components/prospects/prospect-form-dialog";
import { ProspectSheet } from "@/components/prospects/prospect-sheet";
import { ProspectsTable, type SortKey } from "@/components/prospects/prospects-table";
import { countryName, downloadProspectsCsv, type Prospect } from "@/components/prospects/types";

const PAGE_SIZE = 25;
const ALL = "all";

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? ALL)}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

async function forEachSequential(ids: string[], run: (id: string) => Promise<boolean>): Promise<string[]> {
  const ok: string[] = [];
  for (const id of ids) {
    try {
      if (await run(id)) ok.push(id);
    } catch {
      /* compté comme échec */
    }
  }
  return ok;
}

export function ProspectsClient({ initialProspects, initialSearch = "" }: { initialProspects: Prospect[]; initialSearch?: string }) {
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prospects, setProspects] = useState(initialProspects);
  const [page, setPage] = useState(1);
  const [search, setSearchRaw] = useState(initialSearch);
  const [filters, setFiltersRaw] = useState({ status: ALL, country: ALL, priority: ALL, minScore: ALL, fit: "TARGETED" });
  const setSearch = (v: string) => {
    setSearchRaw(v);
    setPage(1);
  };
  const setFilters: typeof setFiltersRaw = (v) => {
    setFiltersRaw(v);
    setPage(1);
  };
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState("CONTACTED");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [selected, setSelected] = useState<Prospect | null>(null);

  const countryOptions = useMemo(
    () =>
      [...new Set(prospects.map((p) => p.country).filter(Boolean))]
        .map((c) => [c, countryName(c)] as [string, string])
        .sort((a, b) => a[1].localeCompare(b[1], "fr")),
    [prospects]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prospects.filter((p) => {
      if (q) {
        const hay = [p.company, p.email, p.contact, p.country, countryName(p.country), p.sector, p.clientType].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.status !== ALL && p.status !== filters.status) return false;
      if (filters.country !== ALL && p.country !== filters.country) return false;
      if (filters.priority !== ALL && p.priority !== filters.priority) return false;
      if (filters.minScore !== ALL && p.score < Number(filters.minScore)) return false;
      if (filters.fit === "TARGETED" && p.targetFit === "OUT_OF_SCOPE") return false;
      if (filters.fit !== ALL && filters.fit !== "TARGETED" && p.targetFit !== filters.fit) return false;
      return true;
    });
  }, [prospects, search, filters]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "company":
          return a.company.localeCompare(b.company, "fr") * dir;
        case "country":
          return countryName(a.country).localeCompare(countryName(b.country), "fr") * dir;
        case "status":
          return (PROSPECT_STATUS_LABELS[a.status] ?? a.status).localeCompare(PROSPECT_STATUS_LABELS[b.status] ?? b.status, "fr") * dir;
        case "score":
          return (a.score - b.score) * dir;
        default:
          return ((a.createdAt ? Date.parse(a.createdAt) : 0) - (b.createdAt ? Date.parse(b.createdAt) : 0)) * dir;
      }
    });
  }, [filtered, sortKey, sortDir]);


  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = search !== "" || Object.entries(filters).some(([k, v]) => (k === "fit" ? v !== "TARGETED" : v !== ALL));
  const hiddenOut = filters.fit === "TARGETED" ? prospects.filter((p) => p.targetFit === "OUT_OF_SCOPE").length : 0;

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "score" || key === "createdAt" ? "desc" : "asc");
    }
  };

  const toggleOne = (id: string, checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleAllPage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = pageRows.every((p) => next.has(p.id));
      pageRows.forEach((p) => (all ? next.delete(p.id) : next.add(p.id)));
      return next;
    });

  const openForm = (p: Prospect | null) => {
    setSelected(null);
    setEditing(p);
    setFormOpen(true);
  };

  const onSaved = (saved: Prospect, isNew: boolean) => {
    setProspects((prev) => (isNew ? [saved, ...prev] : prev.map((x) => (x.id === saved.id ? { ...x, ...saved } : x))));
    toast.success(isNew ? "Prospect ajouté" : "Prospect mis à jour");
  };

  const deleteOne = async (p: Prospect) => {
    setSelected(null);
    const ok = await confirm({
      title: `Supprimer « ${p.company} » ?`,
      description: "Le prospect et l'historique de ses emails seront supprimés définitivement.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/prospects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return toast.error(data.error || "Suppression impossible");
    }
    setProspects((prev) => prev.filter((x) => x.id !== p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(p.id);
      return next;
    });
    toast.success("Prospect supprimé");
  };

  const bulkApplyStatus = async () => {
    const ids = [...selectedIds];
    if (bulkStatus === "UNSUBSCRIBED") {
      const ok = await confirm({
        title: `Désinscrire ${ids.length} prospect(s) ?`,
        description: "Leurs adresses seront exclues de tout envoi futur.",
        confirmLabel: "Désinscrire",
        destructive: true,
      });
      if (!ok) return;
    }
    setBulkBusy(true);
    const done = await forEachSequential(ids, async (id) =>
      (await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: bulkStatus }),
      })).ok
    );
    setBulkBusy(false);
    if (done.length === 0) return toast.error("Aucune mise à jour réussie");
    setProspects((prev) => prev.map((p) => (done.includes(p.id) ? { ...p, status: bulkStatus } : p)));
    toast.success(`Statut mis à jour pour ${done.length} prospect(s)`);
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    const ok = await confirm({
      title: `Supprimer ${ids.length} prospect(s) ?`,
      description: "Cette action est définitive.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    const done = await forEachSequential(ids, async (id) => (await fetch(`/api/prospects/${id}`, { method: "DELETE" })).ok);
    setBulkBusy(false);
    if (done.length === 0) return toast.error("Aucune suppression réussie");
    setProspects((prev) => prev.filter((p) => !done.includes(p.id)));
    setSelectedIds(new Set());
    toast.success(`${done.length} prospect(s) supprimé(s)${done.length < ids.length ? ` (${ids.length - done.length} échec(s))` : ""}`);
  };

  const importCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/prospects/import", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import impossible");
      toast.success(`${data.imported} prospect(s) importé(s) · ${data.duplicates} doublon(s) ignoré(s) · ${data.invalid} ligne(s) invalide(s)`);
      const refreshed = await fetch("/api/prospects?limit=2000");
      if (refreshed.ok) setProspects(await refreshed.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Prospects"
        description={`${prospects.length.toLocaleString("fr-FR")} prospect(s) · ${filtered.length} affiché(s)${hiddenOut ? ` · ${hiddenOut} hors cible masqué(s)` : ""}`}
        icon={Users}
        actions={
          <>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importer un CSV
            </Button>
            <Button variant="outline" onClick={() => downloadProspectsCsv(sorted, "prospects.csv")} disabled={sorted.length === 0}>
              <Download className="h-4 w-4" />
              Exporter
            </Button>
            <Button onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Rechercher un prospect"
                placeholder="Entreprise, email, contact, pays, activité…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setFilters({ status: ALL, country: ALL, priority: ALL, minScore: ALL, fit: "TARGETED" });
                }}
              >
                <FilterX className="h-4 w-4" />
                Réinitialiser
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Select value={filters.fit} onValueChange={(v) => v && setFilters((f) => ({ ...f, fit: v }))}>
              <SelectTrigger aria-label="Adéquation à la cible" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TARGETED">Cœur de cible et secondaires</SelectItem>
                <SelectItem value="CORE">Cœur de cible uniquement</SelectItem>
                <SelectItem value="SECONDARY">Secondaires uniquement</SelectItem>
                <SelectItem value="OUT_OF_SCOPE">Hors cible</SelectItem>
                <SelectItem value={ALL}>Tous les prospects</SelectItem>
              </SelectContent>
            </Select>
            <FilterSelect label="Statut" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} allLabel="Tous les statuts" options={Object.entries(PROSPECT_STATUS_LABELS)} />
            <FilterSelect label="Pays" value={filters.country} onChange={(v) => setFilters((f) => ({ ...f, country: v }))} allLabel="Tous les pays" options={countryOptions} />
            <FilterSelect label="Priorité" value={filters.priority} onChange={(v) => setFilters((f) => ({ ...f, priority: v }))} allLabel="Toutes les priorités" options={Object.entries(PRIORITY_LABELS)} />
            <FilterSelect
              label="Score minimum"
              value={filters.minScore}
              onChange={(v) => setFilters((f) => ({ ...f, minScore: v }))}
              allLabel="Tous les scores"
              options={[
                ["35", "Score ≥ 35"],
                ["60", "Score ≥ 60 (prioritaires)"],
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedIds.size > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center">
              <span className="font-medium text-primary">{selectedIds.size} sélectionné(s)</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Désélectionner
              </Button>
              {selectedIds.size < sorted.length ? (
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set(sorted.map((p) => p.id)))}>
                  Sélectionner les {sorted.length} résultats
                </Button>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <Select value={bulkStatus} onValueChange={(v) => v && setBulkStatus(v)}>
                  <SelectTrigger aria-label="Nouveau statut" className="h-8 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROSPECT_STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" size="sm" onClick={bulkApplyStatus} disabled={bulkBusy}>
                  Appliquer
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadProspectsCsv(prospects.filter((p) => selectedIds.has(p.id)), "prospects_selection.csv")}>
                  <Download className="h-3.5 w-3.5" />
                  Exporter
                </Button>
                <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={bulkDelete} disabled={bulkBusy}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </Button>
              </div>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-lg font-medium">{prospects.length === 0 ? "Aucun prospect pour l'instant" : "Aucun résultat"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {prospects.length === 0
                  ? "Lancez une recherche de prospects ou importez un fichier CSV (colonnes email, company, country)."
                  : "Modifiez la recherche ou les filtres."}
              </p>
            </div>
          ) : (
            <>
              <ProspectsTable
                rows={pageRows}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                selectedIds={selectedIds}
                onToggle={toggleOne}
                onToggleAll={toggleAllPage}
                onOpen={setSelected}
                onEdit={openForm}
                onDelete={deleteOne}
              />
              <ListPagination page={safePage} totalPages={totalPages} totalItems={sorted.length} itemLabel="prospects" onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <ProspectSheet prospect={selected} onClose={() => setSelected(null)} onEdit={openForm} onDelete={deleteOne} />
      <ProspectFormDialog open={formOpen} onOpenChange={setFormOpen} prospect={editing} onSaved={onSaved} />
    </div>
  );
}
