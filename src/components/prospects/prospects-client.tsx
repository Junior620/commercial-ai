"use client";

import { useState, useRef } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Plus, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";

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
  const [addOpen, setAddOpen] = useState(false);
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

  const filtered = prospects.filter((p) => {
    const matchSearch =
      search === "" ||
      p.company.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.contact && p.contact.toLowerCase().includes(search.toLowerCase())) ||
      p.country.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
    ];
    const csv = [
      headers.join(","),
      ...filtered.map((p) =>
        headers
          .map((h) => {
            const val = p[h as keyof typeof p];
            return `"${String(val ?? "").replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prospects_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageTitle
          title="Prospects"
          description={`${prospects.length} prospects au total`}
          icon={Search}
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par entreprise, email, contact, pays..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v ?? "all")}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="NEW">Nouveau</SelectItem>
                <SelectItem value="CONTACTED">Contacte</SelectItem>
                <SelectItem value="IN_DISCUSSION">En discussion</SelectItem>
                <SelectItem value="CONVERTED">Converti</SelectItem>
                <SelectItem value="COLD">Froid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">Aucun prospect</p>
              <p className="text-sm">
                Importez un CSV ou lancez un scraping pour commencer
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Pays</TableHead>
                    <TableHead>Secteur</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Priorite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((prospect) => (
                    <TableRow key={prospect.id}>
                      <TableCell className="font-medium">
                        {prospect.company}
                      </TableCell>
                      <TableCell>{prospect.contact || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {prospect.email}
                      </TableCell>
                      <TableCell>{prospect.country}</TableCell>
                      <TableCell>{prospect.sector || "-"}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
