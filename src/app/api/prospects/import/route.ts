import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { serverError } from "@/lib/api";
import { inferProspectLanguageFromCountry, normalizeCountryToIso2, normalizeLanguage } from "@/lib/prospect-language";
import { calculateLeadScore, priorityFromScore } from "@/lib/scoring";
import { deduplicateItems } from "@/lib/dedup";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function pick(row: Record<string, string>, keys: string[], max = 200): string | null {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value.slice(0, max);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Fichier trop volumineux (5 Mo maximum)" }, { status: 413 });
    }
    if (!/\.csv$/i.test(file.name) && !file.type.includes("csv") && file.type !== "text/plain") {
      return NextResponse.json({ error: "Format attendu : fichier CSV" }, { status: 415 });
    }

    const { data } = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: true });
    if (data.length > MAX_ROWS) {
      return NextResponse.json({ error: `Trop de lignes (${MAX_ROWS} maximum par import)` }, { status: 413 });
    }

    let invalid = 0;
    const rows = [];
    for (const row of data) {
      const email = pick(row, ["email", "Email", "EMAIL", "e_mail", "mail"])?.toLowerCase();
      const company = pick(row, ["company", "Company", "entreprise", "Entreprise", "societe", "Société", "name", "Name"]);
      const countryRaw = pick(row, ["country", "Country", "pays", "Pays"], 80);
      if (!email || !company || !countryRaw || !EMAIL_REGEX.test(email)) {
        invalid++;
        continue;
      }
      const country = normalizeCountryToIso2(countryRaw);
      const website = pick(row, ["website", "Website", "site", "Site"], 300);
      const sector = pick(row, ["sector", "Sector", "secteur", "Secteur"]);
      const scoring = calculateLeadScore({ title: company, categoryName: sector, country, email, website });
      const score = scoring.score;
      rows.push({
        email,
        company,
        country,
        contact: pick(row, ["contact", "Contact", "nom", "Nom"], 120),
        phone: pick(row, ["phone", "Phone", "telephone", "Téléphone", "Tel"], 60),
        sector,
        clientType: pick(row, ["clientType", "type", "Type"], 60),
        product: pick(row, ["product", "Product", "produit", "Produit"], 60),
        language: normalizeLanguage(pick(row, ["language", "Language", "langue", "Langue"], 10)) || inferProspectLanguageFromCountry(country),
        website,
        score,
        priority: priorityFromScore(score, scoring.fit),
        targetFit: scoring.fit,
        productNeeds: scoring.productNeeds,
        source: "csv_import",
        prospectType: "COMMERCIAL" as const,
      });
    }

    const unique = deduplicateItems(rows);
    const emails = unique.map((r) => r.email);
    const [existing, suppressed] = await Promise.all([
      prisma.prospect.findMany({ where: { email: { in: emails, mode: "insensitive" } }, select: { email: true } }),
      prisma.suppression.findMany({ where: { email: { in: emails } }, select: { email: true } }),
    ]);
    const known = new Set([...existing, ...suppressed].map((r) => r.email.toLowerCase()));
    const toCreate = unique.filter((r) => !known.has(r.email));

    const { count: imported } = await prisma.prospect.createMany({ data: toCreate, skipDuplicates: true });
    return NextResponse.json({ imported, duplicates: rows.length - imported, invalid });
  } catch (err) {
    return serverError("prospects:import", err, "Erreur d'import");
  }
}
