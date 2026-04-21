"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Plus,
  Search,
  Download,
  Trash2,
  Pencil,
  ExternalLink,
  Globe,
  Mail,
  Phone,
  Building2,
  MapPin,
  Star,
  Tag,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FilterX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";
import { AIBadge } from "@/components/ui/ai-badge";
import { ListPagination } from "@/components/shared/list-pagination";

interface Prospect {
  id: string;
  company: string;
  contact: string | null;
  email: string;
  phone: string | null;
  country: string;
  sector: string | null;
  clientType: string | null;
  product: string | null;
  status: string;
  language: string;
  priority: string;
  score: number;
  website: string | null;
  source: string | null;
  notes: string | null;
  createdAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  IN_DISCUSSION: "bg-purple-100 text-purple-800",
  CONVERTED: "bg-green-100 text-green-800",
  COLD: "bg-gray-100 text-gray-800",
  UNSUBSCRIBED: "bg-red-100 text-red-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  LOW: "bg-green-100 text-green-800",
};

export function ProspectsClient({
  initialProspects,
}: {
  initialProspects: Prospect[];
}) {
  const [prospects, setProspects] = useState(initialProspects);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [minScoreFilter, setMinScoreFilter] = useState("all");
  const [sortKey, setSortKey] = useState<
    "createdAt" | "company" | "score" | "country" | "status"
  >("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [bulkStatus, setBulkStatus] = useState<string>("CONTACTED");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    company: "",
    contact: "",
    email: "",
    phone: "",
    country: "",
    sector: "",
    clientType: "",
    product: "",
    language: "en",
    priority: "MEDIUM",
  });
  const [editFormData, setEditFormData] = useState({
    company: "",
    contact: "",
    email: "",
    phone: "",
    country: "",
    sector: "",
    clientType: "",
    product: "",
    language: "en",
    priority: "MEDIUM",
    status: "NEW",
  });
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const openEdit = (p: Prospect) => {
    setEditingId(p.id);
    setEditFormData({
      company: p.company,
      contact: p.contact ?? "",
      email: p.email,
      phone: p.phone ?? "",
      country: p.country,
      sector: p.sector ?? "",
      clientType: p.clientType ?? "",
      product: p.product ?? "",
      language: p.language,
      priority: p.priority,
      status: p.status,
    });
    setEditOpen(true);
  };

  const handleUpdateProspect = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/prospects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: editFormData.company,
          contact: editFormData.contact || null,
          email: editFormData.email,
          phone: editFormData.phone || null,
          country: editFormData.country,
          sector: editFormData.sector || null,
          clientType: editFormData.clientType || null,
          product: editFormData.product || null,
          language: editFormData.language,
          priority: editFormData.priority,
          status: editFormData.status,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      const updated = await res.json();
      setProspects(
        prospects.map((x) => (x.id === editingId ? { ...x, ...updated } : x))
      );
      if (selectedProspect?.id === editingId) {
        setSelectedProspect({ ...selectedProspect, ...updated });
      }
      setEditOpen(false);
      setEditingId(null);
      toast.success("Prospect mis a jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleDeleteProspect = async (p: Prospect) => {
    if (
      !confirm(
        `Supprimer le prospect « ${p.company} » ? Cette action est irreversible.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/prospects/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      setProspects(prospects.filter((x) => x.id !== p.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
      toast.success("Prospect supprime");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const countryOptions = useMemo(() => {
    const set = new Set(prospects.map((p) => p.country).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [prospects]);

  const sectorOptions = useMemo(() => {
    const set = new Set(
      prospects.map((p) => p.sector).filter((s): s is string => !!s && s.trim() !== "")
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [prospects]);

  const filtered = useMemo(
    () =>
      prospects.filter((p) => {
        const q = search.toLowerCase();
        const matchSearch =
          search === "" ||
          p.company.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.contact && p.contact.toLowerCase().includes(q)) ||
          p.country.toLowerCase().includes(q) ||
          (p.sector && p.sector.toLowerCase().includes(q)) ||
          (p.clientType && p.clientType.toLowerCase().includes(q));
        const matchStatus =
          statusFilter === "all" || p.status === statusFilter;
        const matchCountry =
          countryFilter === "all" || p.country === countryFilter;
        const matchPriority =
          priorityFilter === "all" || p.priority === priorityFilter;
        const matchSector =
          sectorFilter === "all" || (p.sector ?? "") === sectorFilter;
        const matchScore =
          minScoreFilter === "all" ||
          p.score >= parseInt(minScoreFilter, 10);
        return (
          matchSearch &&
          matchStatus &&
          matchCountry &&
          matchPriority &&
          matchSector &&
          matchScore
        );
      }),
    [
      prospects,
      search,
      statusFilter,
      countryFilter,
      priorityFilter,
      sectorFilter,
      minScoreFilter,
    ]
  );

  const sortedProspects = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "company":
          cmp = a.company.localeCompare(b.company, "fr");
          break;
        case "country":
          cmp = a.country.localeCompare(b.country, "fr");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "score":
          cmp = a.score - b.score;
          break;
        case "createdAt":
        default: {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          cmp = ta - tb;
          break;
        }
      }
      return cmp * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedProspects.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProspects = sortedProspects.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "company" || key === "country" || key === "status" ? "asc" : "desc");
    }
  };

  const SortHead = ({
    label,
    colKey,
    className,
  }: {
    label: string;
    colKey: typeof sortKey;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
        onClick={() => toggleSort(colKey)}
      >
        {label}
        {sortKey === colKey ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 opacity-70" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 opacity-70" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCountryFilter("all");
    setPriorityFilter("all");
    setSectorFilter("all");
    setMinScoreFilter("all");
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(sortedProspects.map((p) => p.id)));
    toast.success(`${sortedProspects.length} prospect(s) selectionne(s)`);
  };

  const handleBulkStatusApply = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    let ok = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/prospects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: bulkStatus }),
        });
        if (res.ok) ok++;
      } catch {
        /* ignore */
      }
    }
    if (ok === 0) {
      toast.error("Aucune mise a jour reussie");
      return;
    }
    setProspects((prev) =>
      prev.map((p) =>
        selectedIds.has(p.id) ? { ...p, status: bulkStatus } : p
      )
    );
    if (selectedProspect && selectedIds.has(selectedProspect.id)) {
      setSelectedProspect({ ...selectedProspect, status: bulkStatus });
    }
    toast.success(`Statut mis a jour pour ${ok} prospect(s)`);
  };

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (prospects.some((p) => p.id === id)) next.add(id);
      }
      return next;
    });
  }, [prospects]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    countryFilter,
    priorityFilter,
    sectorFilter,
    minScoreFilter,
  ]);

  const allVisibleSelected =
    paginatedProspects.length > 0 &&
    paginatedProspects.every((p) => selectedIds.has(p.id));
  const someVisibleSelected = paginatedProspects.some((p) =>
    selectedIds.has(p.id)
  );

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        paginatedProspects.forEach((p) => next.delete(p.id));
      } else {
        paginatedProspects.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleExportSelected = () => {
    const rows = prospects.filter((p) => selectedIds.has(p.id));
    if (rows.length === 0) return;
    downloadProspectsCsv(rows, "prospects_selection.csv");
    toast.success(`${rows.length} ligne(s) exportee(s)`);
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !confirm(
        `Supprimer ${ids.length} prospect(s) ? Cette action est irreversible.`
      )
    ) {
      return;
    }
    const deletedIds: string[] = [];
    for (const id of ids) {
      try {
        const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
        if (res.ok) deletedIds.push(id);
      } catch {
        /* ignore */
      }
    }
    if (deletedIds.length === 0) {
      toast.error("Aucune suppression reussie");
      return;
    }
    setProspects((prev) => prev.filter((p) => !deletedIds.includes(p.id)));
    setSelectedIds(new Set());
    if (selectedProspect && deletedIds.includes(selectedProspect.id)) {
      setSelectedProspect(null);
    }
    toast.success(
      `${deletedIds.length} prospect(s) supprime(s)${
        deletedIds.length < ids.length
          ? ` (${ids.length - deletedIds.length} echec(s))`
          : ""
      }`
    );
  };

  const handleAddProspect = async () => {
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      const newProspect = await res.json();
      setProspects([newProspect, ...prospects]);
      setAddOpen(false);
      setFormData({
        company: "",
        contact: "",
        email: "",
        phone: "",
        country: "",
        sector: "",
        clientType: "",
        product: "",
        language: "en",
        priority: "MEDIUM",
      });
      toast.success("Prospect ajoute");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/prospects/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Erreur d'import");
      const result = await res.json();
      toast.success(`${result.imported} prospects importes, ${result.duplicates} doublons ignores`);
      window.location.reload();
    } catch {
      toast.error("Erreur lors de l'import");
    }
  };

  const handleExportCSV = () => {
    downloadProspectsCsv(sortedProspects, "prospects_export.csv");
    toast.success("Export genere");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageTitle
          title="Prospects"
          description={`${prospects.length} en base${
            filtered.length !== prospects.length
              ? ` · ${filtered.length} apres filtres`
              : ""
          }`}
          icon={Users}
        />
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleImportCSV}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importer CSV
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
              <span className="inline-flex items-center">
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </span>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Ajouter un prospect</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Entreprise *</Label>
                    <Input
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Input
                      value={formData.contact}
                      onChange={(e) =>
                        setFormData({ ...formData, contact: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telephone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pays *</Label>
                    <Input
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Secteur</Label>
                    <Input
                      value={formData.sector}
                      onChange={(e) =>
                        setFormData({ ...formData, sector: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type client</Label>
                    <Select
                      value={formData.clientType}
                      onValueChange={(v) =>
                        setFormData({ ...formData, clientType: v ?? "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="importer">Importateur</SelectItem>
                        <SelectItem value="distributor">
                          Distributeur
                        </SelectItem>
                        <SelectItem value="manufacturer">Fabricant</SelectItem>
                        <SelectItem value="trader">Trader</SelectItem>
                        <SelectItem value="wholesaler">Grossiste</SelectItem>
                        <SelectItem value="retailer">Detaillant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Produit</Label>
                    <Select
                      value={formData.product}
                      onValueChange={(v) =>
                        setFormData({ ...formData, product: v ?? "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cocoa_beans">
                          Feves de cacao
                        </SelectItem>
                        <SelectItem value="cocoa_butter">
                          Beurre de cacao
                        </SelectItem>
                        <SelectItem value="cocoa_powder">
                          Poudre de cacao
                        </SelectItem>
                        <SelectItem value="cocoa_mass">
                          Masse de cacao
                        </SelectItem>
                        <SelectItem value="derivatives">Derives</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Langue</Label>
                    <Select
                      value={formData.language}
                      onValueChange={(v) =>
                        setFormData({ ...formData, language: v ?? "en" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">Anglais</SelectItem>
                        <SelectItem value="fr">Francais</SelectItem>
                        <SelectItem value="es">Espagnol</SelectItem>
                        <SelectItem value="pt">Portugais</SelectItem>
                        <SelectItem value="de">Allemand</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priorite</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(v) =>
                        setFormData({ ...formData, priority: v ?? "MEDIUM" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">Haute</SelectItem>
                        <SelectItem value="MEDIUM">Moyenne</SelectItem>
                        <SelectItem value="LOW">Basse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button onClick={handleAddProspect} className="w-full">
                Ajouter le prospect
              </Button>
            </DialogContent>
          </Dialog>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Modifier le prospect</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Entreprise *</Label>
                    <Input
                      value={editFormData.company}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          company: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Input
                      value={editFormData.contact}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          contact: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          email: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telephone</Label>
                    <Input
                      value={editFormData.phone}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pays *</Label>
                    <Input
                      value={editFormData.country}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          country: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Secteur</Label>
                    <Input
                      value={editFormData.sector}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          sector: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type client</Label>
                    <Select
                      value={editFormData.clientType || "__ct_none__"}
                      onValueChange={(v) =>
                        setEditFormData({
                          ...editFormData,
                          clientType: v === "__ct_none__" ? "" : (v ?? ""),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ct_none__">Non defini</SelectItem>
                        <SelectItem value="importer">Importateur</SelectItem>
                        <SelectItem value="distributor">
                          Distributeur
                        </SelectItem>
                        <SelectItem value="manufacturer">Fabricant</SelectItem>
                        <SelectItem value="trader">Trader</SelectItem>
                        <SelectItem value="wholesaler">Grossiste</SelectItem>
                        <SelectItem value="retailer">Detaillant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Produit</Label>
                    <Select
                      value={editFormData.product || "__pr_none__"}
                      onValueChange={(v) =>
                        setEditFormData({
                          ...editFormData,
                          product: v === "__pr_none__" ? "" : (v ?? ""),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__pr_none__">Non defini</SelectItem>
                        <SelectItem value="cocoa_beans">
                          Feves de cacao
                        </SelectItem>
                        <SelectItem value="cocoa_butter">
                          Beurre de cacao
                        </SelectItem>
                        <SelectItem value="cocoa_powder">
                          Poudre de cacao
                        </SelectItem>
                        <SelectItem value="cocoa_mass">
                          Masse de cacao
                        </SelectItem>
                        <SelectItem value="derivatives">Derives</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Langue</Label>
                    <Select
                      value={editFormData.language}
                      onValueChange={(v) =>
                        setEditFormData({
                          ...editFormData,
                          language: v ?? "en",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">Anglais</SelectItem>
                        <SelectItem value="fr">Francais</SelectItem>
                        <SelectItem value="es">Espagnol</SelectItem>
                        <SelectItem value="pt">Portugais</SelectItem>
                        <SelectItem value="de">Allemand</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priorite</Label>
                    <Select
                      value={editFormData.priority}
                      onValueChange={(v) =>
                        setEditFormData({
                          ...editFormData,
                          priority: v ?? "MEDIUM",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">Haute</SelectItem>
                        <SelectItem value="MEDIUM">Moyenne</SelectItem>
                        <SelectItem value="LOW">Basse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select
                    value={editFormData.status}
                    onValueChange={(v) =>
                      setEditFormData({
                        ...editFormData,
                        status: v ?? "NEW",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">Nouveau</SelectItem>
                      <SelectItem value="CONTACTED">Contacte</SelectItem>
                      <SelectItem value="IN_DISCUSSION">En discussion</SelectItem>
                      <SelectItem value="CONVERTED">Converti</SelectItem>
                      <SelectItem value="COLD">Froid</SelectItem>
                      <SelectItem value="UNSUBSCRIBED">Desabonne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleUpdateProspect} className="w-full">
                Enregistrer
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="space-y-4 bg-muted/30 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Entreprise, email, contact, pays, secteur, type client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1"
              onClick={resetFilters}
            >
              <FilterX className="h-4 w-4" />
              Reinitialiser filtres
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v ?? "all")}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="NEW">Nouveau</SelectItem>
                <SelectItem value="CONTACTED">Contacte</SelectItem>
                <SelectItem value="IN_DISCUSSION">En discussion</SelectItem>
                <SelectItem value="CONVERTED">Converti</SelectItem>
                <SelectItem value="COLD">Froid</SelectItem>
                <SelectItem value="UNSUBSCRIBED">Desabonne</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={countryFilter}
              onValueChange={(v) => setCountryFilter(v ?? "all")}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pays" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="all">Tous les pays</SelectItem>
                {countryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter}
              onValueChange={(v) => setPriorityFilter(v ?? "all")}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Priorite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorites</SelectItem>
                <SelectItem value="HIGH">Haute</SelectItem>
                <SelectItem value="MEDIUM">Moyenne</SelectItem>
                <SelectItem value="LOW">Basse</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sectorFilter}
              onValueChange={(v) => setSectorFilter(v ?? "all")}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Secteur" />
              </SelectTrigger>
              <SelectContent
                className="max-h-56 min-w-[min(100%,20rem)]"
                alignItemWithTrigger={false}
              >
                <SelectItem value="all">Tous secteurs</SelectItem>
                {sectorOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={minScoreFilter}
              onValueChange={(v) => setMinScoreFilter(v ?? "all")}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Score min." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les scores</SelectItem>
                <SelectItem value="30">Score ≥ 30</SelectItem>
                <SelectItem value="50">Score ≥ 50</SelectItem>
                <SelectItem value="60">Score ≥ 60 (chaud)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Tri :{" "}
              <span className="font-medium text-foreground">
                {sortKey === "createdAt"
                  ? "Date creation"
                  : sortKey === "company"
                    ? "Entreprise"
                    : sortKey === "score"
                      ? "Score"
                      : sortKey === "country"
                        ? "Pays"
                        : "Statut"}
              </span>{" "}
              ({sortDir === "asc" ? "croissant" : "decroissant"}) · Page{" "}
              {safePage}/{totalPages}
            </p>
            {sortedProspects.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 w-fit text-xs"
                onClick={selectAllFiltered}
              >
                Selectionner les {sortedProspects.length} resultat(s) filtres
              </Button>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center">
              <span className="font-semibold tabular-nums text-primary">
                {selectedIds.size} selectionne(s)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Tout deselectionner
                </Button>
                <Select
                  value={bulkStatus}
                  onValueChange={(v) => setBulkStatus(v ?? "CONTACTED")}
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">Nouveau</SelectItem>
                    <SelectItem value="CONTACTED">Contacte</SelectItem>
                    <SelectItem value="IN_DISCUSSION">En discussion</SelectItem>
                    <SelectItem value="CONVERTED">Converti</SelectItem>
                    <SelectItem value="COLD">Froid</SelectItem>
                    <SelectItem value="UNSUBSCRIBED">Desabonne</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8"
                  onClick={handleBulkStatusApply}
                >
                  Appliquer le statut
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={handleExportSelected}
                >
                  <Download className="h-3.5 w-3.5" />
                  Exporter selection
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </Button>
              </div>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">Aucun prospect</p>
              <p className="text-sm">
                Importez un CSV ou lancez un scraping pour commencer
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="overflow-x-scroll rounded-md border pb-2 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
              >
                <Table className="min-w-[1120px]">
                <TableHeader className="sticky top-0 z-10 bg-muted/95 shadow-sm backdrop-blur-sm [&_tr]:border-b">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40px] bg-muted/95 pr-0">
                      <div
                        className="flex items-center justify-center py-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={() => toggleSelectAllVisible()}
                          aria-label="Selectionner tous les prospects visibles"
                          title={
                            someVisibleSelected && !allVisibleSelected
                              ? "Selection partielle — cliquer pour tout selectionner"
                              : undefined
                          }
                        />
                      </div>
                    </TableHead>
                    <SortHead label="Entreprise" colKey="company" className="bg-muted/95" />
                    <TableHead className="bg-muted/95">Contact</TableHead>
                    <TableHead className="bg-muted/95">Email</TableHead>
                    <SortHead label="Pays" colKey="country" className="bg-muted/95" />
                    <TableHead className="min-w-[8.5rem] max-w-[14rem] whitespace-normal bg-muted/95">
                      Secteur
                    </TableHead>
                    <TableHead className="bg-muted/95">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
                          onClick={() => toggleSort("score")}
                        >
                          Score
                          {sortKey === "score" ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 opacity-70" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 opacity-70" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                        <AIBadge label="IA" size="xs" variant="soft" title="Score calcule par IA" />
                      </div>
                    </TableHead>
                    <SortHead label="Statut" colKey="status" className="bg-muted/95" />
                    <TableHead className="bg-muted/95">Priorite</TableHead>
                    <TableHead className="w-[100px] bg-muted/95 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProspects.map((prospect) => (
                    <TableRow
                      key={prospect.id}
                      className="cursor-pointer odd:bg-muted/20 hover:bg-muted/60 transition-colors"
                      onClick={() => setSelectedProspect(prospect)}
                    >
                      <TableCell
                        className="w-[40px] pr-0 align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center py-1">
                          <Checkbox
                            checked={selectedIds.has(prospect.id)}
                            onCheckedChange={(v) =>
                              toggleSelectOne(prospect.id, v === true)
                            }
                            aria-label={`Selectionner ${prospect.company}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {prospect.company}
                      </TableCell>
                      <TableCell>
                        {prospect.contact?.trim() ? (
                          prospect.contact
                        ) : (
                          <span className="text-muted-foreground italic">
                            Non renseigne
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {prospect.email}
                      </TableCell>
                      <TableCell>{prospect.country}</TableCell>
                      <TableCell className="min-w-[8.5rem] max-w-[14rem] break-words text-sm align-top">
                        {prospect.sector || "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold ${
                            prospect.score >= 60
                              ? "text-green-600"
                              : prospect.score >= 30
                                ? "text-yellow-600"
                                : prospect.score >= 0
                                  ? "text-gray-600"
                                  : "text-red-600"
                          }`}
                        >
                          {prospect.score}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            STATUS_COLORS[prospect.status] || ""
                          }
                        >
                          {prospect.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            PRIORITY_COLORS[prospect.priority] || ""
                          }
                        >
                          {prospect.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(prospect);
                            }}
                            aria-label="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProspect(prospect);
                            }}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
              <ListPagination
                page={safePage}
                totalPages={totalPages}
                totalItems={sortedProspects.length}
                itemLabel="prospects"
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fiche detail prospect */}
      <Sheet
        open={selectedProspect !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedProspect(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {selectedProspect && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  {selectedProspect.company}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="secondary"
                    className={STATUS_COLORS[selectedProspect.status] || ""}
                  >
                    {STATUS_LABELS[selectedProspect.status] ?? selectedProspect.status}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={PRIORITY_COLORS[selectedProspect.priority] || ""}
                  >
                    {PRIORITY_LABELS[selectedProspect.priority] ?? selectedProspect.priority}
                  </Badge>
                  <span className="ml-auto inline-flex items-center gap-2">
                    <AIBadge label="IA" size="xs" variant="soft" title="Score IA" />
                    <span
                      className={`text-sm font-semibold ${
                        selectedProspect.score >= 60
                          ? "text-green-600"
                          : selectedProspect.score >= 30
                            ? "text-yellow-600"
                            : "text-gray-600"
                      }`}
                    >
                      Score : {selectedProspect.score}
                    </span>
                  </span>
                </SheetDescription>
              </SheetHeader>

              <Separator />

              <div className="space-y-4 px-4">
                <DetailRow icon={User} label="Contact" value={selectedProspect.contact} />
                <DetailRow icon={Mail} label="Email" value={selectedProspect.email} href={`mailto:${selectedProspect.email}`} />
                <DetailRow icon={Phone} label="Telephone" value={selectedProspect.phone} href={selectedProspect.phone ? `tel:${selectedProspect.phone}` : undefined} />
                <DetailRow icon={MapPin} label="Pays" value={selectedProspect.country} />
                <DetailRow icon={Tag} label="Secteur" value={selectedProspect.sector} />
                <DetailRow icon={Star} label="Type client" value={selectedProspect.clientType} />
                <DetailRow icon={Tag} label="Produit" value={selectedProspect.product} />
                <DetailRow icon={Globe} label="Site web" value={selectedProspect.website} href={selectedProspect.website ?? undefined} external />
                <DetailRow icon={Tag} label="Source" value={selectedProspect.source} />
                <DetailRow icon={Tag} label="Langue" value={LANG_LABELS[selectedProspect.language] ?? selectedProspect.language} />

                {selectedProspect.notes && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedProspect.notes}</p>
                  </div>
                )}
              </div>

              <Separator />

              <SheetFooter className="flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setSelectedProspect(null);
                    openEdit(selectedProspect);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    const p = selectedProspect;
                    setSelectedProspect(null);
                    handleDeleteProspect(p);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacte",
  IN_DISCUSSION: "En discussion",
  CONVERTED: "Converti",
  COLD: "Froid",
  UNSUBSCRIBED: "Desabonne",
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Haute",
  MEDIUM: "Moyenne",
  LOW: "Basse",
};

const LANG_LABELS: Record<string, string> = {
  en: "Anglais",
  fr: "Francais",
  es: "Espagnol",
  pt: "Portugais",
  de: "Allemand",
};

function downloadProspectsCsv(rows: Prospect[], filename: string) {
  const headers = [
    "company",
    "contact",
    "email",
    "phone",
    "country",
    "sector",
    "clientType",
    "product",
    "status",
    "score",
  ] as const;
  const csv = [
    headers.join(","),
    ...rows.map((p) =>
      headers
        .map((h) => {
          const val = p[h as keyof Prospect];
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  href?: string;
  external?: boolean;
}) {
  const display = value || "-";
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href && value ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            {display}
            {external && <ExternalLink className="h-3 w-3" />}
          </a>
        ) : (
          <p className="text-sm font-medium">{display}</p>
        )}
      </div>
    </div>
  );
}
