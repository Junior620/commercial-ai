"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COUNTRY_NAMES = new Intl.DisplayNames(["fr"], { type: "region" });

function countryLabel(code: string): string {
  if (/^[A-Z]{2}$/.test(code)) {
    try {
      return COUNTRY_NAMES.of(code) ?? code;
    } catch {
      return code;
    }
  }
  return code;
}

/** Histogramme horizontal des prospects par pays (couleurs de la charte). */
export function CountryChart({ data }: { data: { country: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Aucun prospect pour l&apos;instant</p>;
  }
  const rows = data.map((d) => ({ name: countryLabel(d.country), count: d.count }));
  return (
    <div role="img" aria-label={`Prospects par pays : ${rows.map((r) => `${r.name} ${r.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 34)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} fontSize={12} stroke="var(--muted-foreground)" />
          <YAxis type="category" dataKey="name" width={110} fontSize={12} stroke="var(--muted-foreground)" />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 13,
            }}
            formatter={(value) => [value, "Prospects"]}
          />
          <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
