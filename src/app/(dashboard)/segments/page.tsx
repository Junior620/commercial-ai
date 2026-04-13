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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Layers, Users } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";

interface Segment {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, string | string[]>;
  _count?: { prospectLinks: number };
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
];

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [addOpen, setAddOpen] = useState(false);
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
    try {
      const res = await fetch("/api/segments");
      if (res.ok) setSegments(await res.json());
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
      toast.success("Segment cree");
      setAddOpen(false);
      fetchSegments();
    } catch {
      toast.error("Erreur de creation");
    }
  };

  const handleCreatePredefined = async (preset: (typeof PREDEFINED_SEGMENTS)[0]) => {
    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preset.name,
          description: `Segment predefini : ${preset.name}`,
          filters: preset.filters,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success(`Segment "${preset.name}" cree`);
      fetchSegments();
    } catch {
      toast.error("Erreur");
    }
  };

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
              Creer un segment
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
              Creer le segment
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Segments predefinis</CardTitle>
          <CardDescription>
            Cliquez pour creer rapidement un segment type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {PREDEFINED_SEGMENTS.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                className="h-auto justify-start p-4 text-left"
                onClick={() => handleCreatePredefined(preset)}
              >
                <Layers className="mr-2 h-4 w-4 shrink-0" />
                <span className="text-sm">{preset.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {segments.map((segment) => (
          <Card key={segment.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{segment.name}</CardTitle>
                <Badge variant="secondary">
                  <Users className="mr-1 h-3 w-3" />
                  {segment._count?.prospectLinks ?? 0}
                </Badge>
              </div>
              {segment.description && (
                <CardDescription>{segment.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.entries(segment.filters || {}).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {Array.isArray(value) ? value.join(", ") : String(value)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {segments.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Layers className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>Aucun segment cree</p>
          </div>
        )}
      </div>
    </div>
  );
}
