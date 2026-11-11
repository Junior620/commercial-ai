"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
    return <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Aucun prospect pour l&apos;instant</p>;
  }
  const rows = data.map((d, i) => ({ name: countryLabel(d.country), count: d.count, rank: i }));
  return (
    <div role="img" aria-label={`Prospects par pays : ${rows.map((r) => `${r.name} ${r.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 36)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 44, top: 2, bottom: 2 }} barCategoryGap={8}>
          <defs>
            <linearGradient id="country-bar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="oklch(0.687 0.134 117.7)" />
            </linearGradient>
          </defs>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={112}
            tickLine={false}
            axisLine={false}
            fontSize={13}
            tick={{ fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 13,
            }}
            formatter={(value) => [value, "Prospects"]}
          />
          <Bar dataKey="count" fill="url(#country-bar)" radius={[0, 6, 6, 0]} background={{ fill: "var(--muted)", radius: 6 }}>
            <LabelList dataKey="count" position="right" fontSize={12} fontWeight={600} fill="var(--foreground)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
