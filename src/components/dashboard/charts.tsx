"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacte",
  IN_DISCUSSION: "En discussion",
  CONVERTED: "Converti",
  COLD: "Froid",
  UNSUBSCRIBED: "Desabonne",
};

const PIE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#6b7280",
];

interface ChartProps {
  type: "country" | "status" | "source";
  data: Array<{
    country?: string;
    status?: string;
    source?: string;
    count: number;
  }>;
}

export function DashboardCharts({ type, data }: ChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        Aucune donnee disponible
      </div>
    );
  }

  if (type === "country" || type === "source") {
    const key = type === "country" ? "country" : "source";
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey={key} fontSize={11} interval={0} angle={-20} textAnchor="end" height={72} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Bar
            dataKey="count"
            fill={type === "source" ? "#8b5cf6" : "#3b82f6"}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const pieData = data.map((d) => ({
    name: STATUS_LABELS[d.status || ""] || d.status || "",
    value: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {pieData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={PIE_COLORS[index % PIE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
