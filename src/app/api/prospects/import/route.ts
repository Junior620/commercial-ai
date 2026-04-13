import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }

    const text = await file.text();
    const { data, errors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Erreur de parsing CSV" },
        { status: 400 }
      );
    }

    let imported = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const row of data as Record<string, string>[]) {
      const email = (
        row.email ||
        row.Email ||
        row.EMAIL ||
        row.e_mail ||
        ""
      ).trim();
      const company = (
        row.company ||
        row.Company ||
        row.entreprise ||
        row.Entreprise ||
        row.societe ||
        row.name ||
        row.Name ||
        ""
      ).trim();
      const country = (
        row.country ||
        row.Country ||
        row.pays ||
        row.Pays ||
        ""
      ).trim();

      if (!email || !company || !country) {
        invalid++;
        continue;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        invalid++;
        continue;
      }

      try {
        await prisma.prospect.create({
          data: {
            email,
            company,
            country,
            contact:
              row.contact ||
              row.Contact ||
              row.nom ||
              row.Nom ||
              null,
            phone:
              row.phone ||
              row.Phone ||
              row.telephone ||
              row.Tel ||
              null,
            sector:
              row.sector ||
              row.Sector ||
              row.secteur ||
              row.Secteur ||
              null,
            clientType:
              row.clientType ||
              row.type ||
              row.Type ||
              null,
            product:
              row.product ||
              row.Product ||
              row.produit ||
              row.Produit ||
              null,
            language:
              row.language ||
              row.Language ||
              row.langue ||
              "en",
            website:
              row.website ||
              row.Website ||
              row.site ||
              null,
            source: "csv_import",
          },
        });
        imported++;
      } catch {
        duplicates++;
      }
    }

    return NextResponse.json({ imported, duplicates, invalid });
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur d'import" },
      { status: 500 }
    );
  }
}
