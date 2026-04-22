"use client";

import { useState, useEffect } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Layers, Loader2, MoreVertical, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";
import { ListPagination } from "@/components/shared/list-pagination";
import { formatSegmentFilterChips } from "@/lib/segment-display";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Segment {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  _count?: { prospectLinks: number };
  liveProspectsCount?: number;
  createdAt: string;
}

interface SegmentProspect {
  id: string;
  company: string;
  contact: string | null;
  email: string;
  country: string;
  sector: string | null;
  clientType: string | null;
  product: string | null;
  language: string;
  score: number;
  status: string;
  priority: string;
  source: string | null;
  createdAt: string;
}

const PREDEFINED_SEGMENTS = [
  {
    name: "Industriels agroalimentaires",
    filters: { sector: "food", clientType: "manufacturer" },
  },
  {
    name: "Chocolatiers artisanaux",
    filters: { sector: "chocolate", clientType: "manufacturer" },
  },
  {
    name: "Importateurs matieres premieres",
    filters: { clientType: "importer" },
  },
  {
    name: "Distributeurs specialises",
    filters: { clientType: "distributor" },
  },
  {
    name: "Industriels cosmetiques",
    filters: { sector: "cosmetics" },
  },
  {
    name: "Traders matieres premieres",
    filters: { clientType: "trader" },
  },
  {
    name: "Torréfacteurs café",
    filters: { sector: "coffee", clientType: "manufacturer" },
  },
  {
    name: "Importateurs café vert",
    filters: { products: ["green_coffee"], clientType: "importer" },
  },
  {
    name: "Agri-Tech cacao/café",
    filters: { sectors: ["agri-tech", "precision agriculture", "satellite"] },
  },
  {
    name: "Conformité RDUE & traçabilité",
    filters: { sectors: ["traceability", "compliance", "sustainability"] },
  },
  {
    name: "Équipement torréfaction & tri",
    filters: { sectors: ["machinery"], clientType: "manufacturer" },
  },
  {
    name: "Emballage haute barrière",
    filters: { sectors: ["packaging", "materials"] },
  },
  {
    name: "Finance agricole & assurance",
    filters: { sectors: ["finance", "insurance"], clientType: "distributor" },
  },
  {
    name: "Bioéconomie circulaire",
    filters: { sectors: ["bioeconomy", "waste valorization"] },
  },
];

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;
  const [addOpen, setAddOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [selectedProspects, setSelectedProspects] = useState<SegmentProspect[]>([]);
  const [selectedLiveCount, setSelectedLiveCount] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    countries: "",
    sectors: "",
    clientTypes: "",
    products: "",
    priorities: "",
    languages: "",
    minScore: "",
    statuses: "",
  });

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    setLoadingSegments(true);
    try {
      const res = await fetch("/api/segments");
      if (res.ok) {
        const fastSegments = (await res.json()) as Segment[];
        setSegments(fastSegments);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSegments(false);
    }

    // 2e passe non bloquante: remonte les compteurs live exacts.
    // On garde ainsi un affichage rapide + des chiffres fiables quelques
    // instants après le rendu initial.
    try {
      const resLive = await fetch("/api/segments?live=1");
      if (!resLive.ok) return;
      const liveSegments = (await resLive.json()) as Segment[];
      const liveCountById = new Map(
        liveSegments.map((s) => [s.id, s.liveProspectsCount ?? 0])
      );
      setSegments((prev) =>
        prev.map((s) => ({
          ...s,
          liveProspectsCount: liveCountById.get(s.id) ?? s.liveProspectsCount,
        }))
      );
    } catch {
      // ignore
    }
  };

  const handleCreate = async () => {
    const filters: Record<string, unknown> = {};
    if (formData.countries)
      filters.countries = formData.countries.split(",").map((s) => s.trim());
    if (formData.sectors)
      filters.sectors = formData.sectors.split(",").map((s) => s.trim());
    if (formData.clientTypes)
      filters.clientTypes = formData.clientTypes.split(",").map((s) => s.trim());
    if (formData.products)
      filters.products = formData.products.split(",").map((s) => s.trim());
    if (formData.priorities)
      filters.priorities = formData.priorities.split(",").map((s) => s.trim());
    if (formData.languages)
      filters.languages = formData.languages.split(",").map((s) => s.trim());
    if (formData.minScore) filters.minScore = parseInt(formData.minScore);
    if (formData.statuses)
      filters.statuses = formData.statuses.split(",").map((s) => s.trim());

    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          filters,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Segment créé");
      setAddOpen(false);
      fetchSegments();
    } catch {
      toast.error("Erreur de creation");
    }
  };

  const handleCreatePredefined = async (preset: (typeof PREDEFINED_SEGMENTS)[0]) => {
    if (segments.some((s) => s.name.trim() === preset.name.trim())) {
      toast.message(`« ${preset.name} » existe déjà`, {
        description:
          "Supprimez le doublon dans la liste ou créez un segment personnalisé.",
      });
      return;
    }
    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preset.name,
          description: `Segment prédéfini : ${preset.name}`,
          filters: preset.filters,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success(`Segment « ${preset.name} » créé`);
      fetchSegments();
    } catch {
      toast.error("Erreur");
    }
  };

  const handleDelete = async (segment: Segment) => {
    if (
      !confirm(
        `Supprimer le segment « ${segment.name} » ? Les campagnes liées ne seront plus associées à ce segment.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/segments/${segment.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Segment supprimé");
      setPage(1);
      fetchSegments();
    } catch {
      toast.error("Suppression impossible");
    }
  };

  const openSegmentDetails = async (segment: Segment) => {
    setSelectedSegment(segment);
    setSelectedProspects([]);
    setSelectedLiveCount(segment.liveProspectsCount ?? 0);
    setDetailsLoading(true);
    setDetailsOpen(true);
    try {
      const res = await fetch(`/api/segments/${segment.id}`);
      if (!res.ok) throw new Error("Erreur de chargement du segment");
      const data = await res.json();
      setSelectedProspects((data?.prospects as SegmentProspect[]) ?? []);
      setSelectedLiveCount(Number(data?.liveProspectsCount ?? 0));
    } catch {
      toast.error("Impossible de charger les prospects de ce segment");
    } finally {
      setDetailsLoading(false);
    }
  };

  const escapeCsvCell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const buildSegmentCsv = (prospects: SegmentProspect[]) => {
    const header = [
      "Entreprise",
      "Contact",
      "Email",
      "Pays",
      "Secteur",
      "Type client",
      "Produit",
      "Langue",
      "Score",
      "Statut",
      "Priorite",
      "Source",
      "Date creation",
    ];

    const rows = prospects.map((p) => [
      p.company,
      p.contact ?? "",
      p.email,
      p.country,
      p.sector ?? "",
      p.clientType ?? "",
      p.product ?? "",
      p.language,
      p.score,
      p.status,
      p.priority,
      p.source ?? "",
      new Date(p.createdAt).toLocaleString("fr-FR"),
    ]);

    return [header, ...rows]
      .map((cols) => cols.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n");
  };

  const exportSelectedProspectsCsv = () => {
    if (!selectedSegment || selectedProspects.length === 0) {
      toast.error("Aucun prospect a exporter");
      return;
    }

    const csv = buildSegmentCsv(selectedProspects);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = selectedSegment.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    link.href = url;
    link.download = `segment-${safeName || "prospects"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Export CSV lance");
  };

  const totalPages = Math.max(1, Math.ceil(segments.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedSegments = segments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageTitle
          title="Segmentation"
          description="Regroupez vos prospects pour cibler vos campagnes"
          icon={Layers}
        />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
            <span className="inline-flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              Créer un segment
            </span>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau segment</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nom du segment *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex: Importateurs Europe"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Pays (separes par virgule)</Label>
                <Input
                  value={formData.countries}
                  onChange={(e) =>
                    setFormData({ ...formData, countries: e.target.value })
                  }
                  placeholder="France, Germany, Belgium"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Secteurs</Label>
                  <Input
                    value={formData.sectors}
                    onChange={(e) =>
                      setFormData({ ...formData, sectors: e.target.value })
                    }
                    placeholder="food, cosmetics"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Types client</Label>
                  <Input
                    value={formData.clientTypes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        clientTypes: e.target.value,
                      })
                    }
                    placeholder="importer, trader"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Produits (codes, séparés par virgule)</Label>
                <Input
                  value={formData.products}
                  onChange={(e) =>
                    setFormData({ ...formData, products: e.target.value })
                  }
                  placeholder="cocoa_butter, coffee_beans, green_coffee, instant_coffee"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Score minimum</Label>
                  <Input
                    type="number"
                    value={formData.minScore}
                    onChange={(e) =>
                      setFormData({ ...formData, minScore: e.target.value })
                    }
                    placeholder="30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Langues</Label>
                  <Input
                    value={formData.languages}
                    onChange={(e) =>
                      setFormData({ ...formData, languages: e.target.value })
                    }
                    placeholder="en, fr"
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full">
              Créer le segment
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-dashed bg-muted/20 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Modèles rapides</CardTitle>
          <CardDescription>
            Un clic crée un segment avec des critères courants. Vous pourrez
            l’affiner plus tard via une campagne ou en recréant un segment
            personnalisé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PREDEFINED_SEGMENTS.map((preset) => (
              <Button
                key={preset.name}
                variant="secondary"
                className="h-auto justify-start gap-2 border border-border/80 bg-background px-3 py-3 text-left shadow-sm hover:bg-muted/60"
                onClick={() => handleCreatePredefined(preset)}
              >
                <Layers className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium leading-snug">
                  {preset.name}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Vos segments</h2>
          <p className="text-sm text-muted-foreground">
            {loadingSegments
              ? "Chargement des segments..."
              : segments.length === 0
              ? "Aucun segment pour l’instant."
              : `${segments.length} segment${segments.length > 1 ? "s" : ""} — membres comptés selon les filtres en base.`}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {loadingSegments && (
          <div className="col-span-full rounded-lg border border-dashed bg-muted/10 py-12 text-center text-muted-foreground">
            Chargement...
          </div>
        )}
        {!loadingSegments &&
          paginatedSegments.map((segment) => {
          const count =
            segment.liveProspectsCount ?? segment._count?.prospectLinks ?? 0;
          const chips = formatSegmentFilterChips(segment.filters);
          const isPresetDesc =
            !!segment.description &&
            /Segment\s+pr[ée]d[ée]fini\s*:/i.test(segment.description);

          return (
            <Card
              key={segment.id}
              className="cursor-pointer border-border/80 transition-shadow hover:shadow-md"
              role="button"
              tabIndex={0}
              onClick={() => openSegmentDetails(segment)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openSegmentDetails(segment);
                }
              }}
            >
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base leading-snug">
                        {segment.name}
                      </CardTitle>
                      {isPresetDesc && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          Modèle
                        </Badge>
                      )}
                    </div>
                    {segment.description && (
                      <CardDescription className="line-clamp-2 text-xs">
                        {segment.description}
                      </CardDescription>
                    )}
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Badge
                      variant={count > 0 ? "secondary" : "outline"}
                      className={cn(
                        "tabular-nums",
                        count === 0 &&
                          "border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                      )}
                    >
                      <Users className="mr-1 h-3 w-3" />
                      {count}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                        aria-label="Actions segment"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(segment)}
                        >
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {chips.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {chips.map(({ label, text }) => (
                      <li
                        key={`${segment.id}-${label}-${text}`}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-snug"
                      >
                        <span className="shrink-0 font-medium text-muted-foreground">
                          {label}
                        </span>
                        <span className="min-w-0 text-foreground">{text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Aucun critère enregistré.
                  </p>
                )}
                {count === 0 && chips.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Aucun prospect ne correspond encore à ces critères (vérifiez
                    les valeurs en base ou importez des fiches).
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!loadingSegments && segments.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed bg-muted/10 py-12 text-center text-muted-foreground">
            <Layers className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">Aucun segment créé</p>
            <p className="mt-1 text-xs">
              Utilisez un modèle ci-dessus ou « Créer un segment ».
            </p>
          </div>
        )}
        </div>
        {!loadingSegments && segments.length > 0 && (
          <ListPagination
            page={safePage}
            totalPages={totalPages}
            totalItems={segments.length}
            itemLabel="segments"
            onPageChange={setPage}
          />
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="w-[min(96vw,88rem)] sm:max-w-6xl">
          <DialogHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle className="pr-8">
              {selectedSegment?.name ?? "Segment"} · {selectedLiveCount} prospect
              {selectedLiveCount > 1 ? "s" : ""}
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportSelectedProspectsCsv}
              disabled={detailsLoading || selectedProspects.length === 0}
              className="w-full sm:mr-8 sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Exporter CSV
            </Button>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des prospects...
            </div>
          ) : selectedProspects.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-muted-foreground">
              Aucun prospect trouvé pour ce segment.
            </div>
          ) : (
            <div className="max-h-[78vh] overflow-auto rounded-lg border">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-muted/90">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-medium">Entreprise</th>
                    <th className="px-3 py-2 font-medium">Contact</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Pays</th>
                    <th className="px-3 py-2 font-medium">Secteur</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProspects.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{p.company}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.contact || "—"}
                      </td>
                      <td className="px-3 py-2">{p.email}</td>
                      <td className="px-3 py-2">{p.country}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.sector || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.clientType || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="tabular-nums">
                          {p.score}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
