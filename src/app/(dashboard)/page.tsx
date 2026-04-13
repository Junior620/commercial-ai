import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { Users, Mail, Send, TrendingUp, Target, Globe } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/charts";
import { PageTitle } from "@/components/layout/page-title";

async function getStats() {
  const [
    totalProspects,
    totalEmails,
    sentEmails,
    deliveredEmails,
    openedEmails,
    repliedEmails,
    activeCampaigns,
    hotProspects,
    prospectsByCountry,
    prospectsByStatus,
  ] = await Promise.all([
    prisma.prospect.count(),
    prisma.email.count(),
    prisma.email.count({ where: { status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] } } }),
    prisma.email.count({ where: { status: { in: ["DELIVERED", "OPENED", "CLICKED", "REPLIED"] } } }),
    prisma.email.count({ where: { status: { in: ["OPENED", "CLICKED", "REPLIED"] } } }),
    prisma.email.count({ where: { status: "REPLIED" } }),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.prospect.count({ where: { score: { gte: 60 } } }),
    prisma.prospect.groupBy({ by: ["country"], _count: true, orderBy: { _count: { country: "desc" } }, take: 10 }),
    prisma.prospect.groupBy({ by: ["status"], _count: true }),
  ]);

  const openRate = sentEmails > 0 ? ((openedEmails / sentEmails) * 100).toFixed(1) : "0";
  const replyRate = sentEmails > 0 ? ((repliedEmails / sentEmails) * 100).toFixed(1) : "0";

  return {
    totalProspects,
    totalEmails,
    sentEmails,
    deliveredEmails,
    openRate,
    replyRate,
    activeCampaigns,
    hotProspects,
    prospectsByCountry: prospectsByCountry.map((p) => ({
      country: p.country,
      count: p._count,
    })),
    prospectsByStatus: prospectsByStatus.map((p) => ({
      status: p.status,
      count: p._count,
    })),
  };
}

export default async function DashboardPage() {
  let stats;
  try {
    stats = await getStats();
  } catch {
    stats = null;
  }

  const kpis = stats
    ? [
        { label: "Prospects", value: stats.totalProspects, icon: Users, color: "text-blue-600" },
        { label: "Emails envoyes", value: stats.sentEmails, icon: Send, color: "text-green-600" },
        { label: "Taux ouverture", value: `${stats.openRate}%`, icon: Mail, color: "text-orange-600" },
        { label: "Taux reponse", value: `${stats.replyRate}%`, icon: TrendingUp, color: "text-purple-600" },
        { label: "Campagnes actives", value: stats.activeCampaigns, icon: Target, color: "text-red-600" },
        { label: "Prospects chauds", value: stats.hotProspects, icon: Globe, color: "text-amber-600" },
      ]
    : [
        { label: "Prospects", value: 0, icon: Users, color: "text-blue-600" },
        { label: "Emails envoyes", value: 0, icon: Send, color: "text-green-600" },
        { label: "Taux ouverture", value: "0%", icon: Mail, color: "text-orange-600" },
        { label: "Taux reponse", value: "0%", icon: TrendingUp, color: "text-purple-600" },
        { label: "Campagnes actives", value: 0, icon: Target, color: "text-red-600" },
        { label: "Prospects chauds", value: 0, icon: Globe, color: "text-amber-600" },
      ];

  return (
    <div className="space-y-6">
      <PageTitle
        title="Dashboard"
        description="Vue d'ensemble de votre prospection commerciale"
        icon={TrendingUp}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Prospects par pays</CardTitle>
              <CardDescription>Top 10 des pays</CardDescription>
            </CardHeader>
            <CardContent>
              <DashboardCharts
                type="country"
                data={stats.prospectsByCountry}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Prospects par statut</CardTitle>
              <CardDescription>Repartition actuelle</CardDescription>
            </CardHeader>
            <CardContent>
              <DashboardCharts
                type="status"
                data={stats.prospectsByStatus}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
