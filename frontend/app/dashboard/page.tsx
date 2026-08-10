import React from "react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/dashboard/stat-card";
import { AccessOverviewChart } from "@/components/dashboard/access-overview-chart";
import { RecognitionBreakdown } from "@/components/dashboard/recognition-breakdown";
import { RecentAccessTable, AccessEventItem } from "@/components/dashboard/recent-access-table";
import { SecurityAlertsPanel, SecurityAlertItem } from "@/components/dashboard/security-alerts-panel";
import { SystemHealthPanel } from "@/components/dashboard/system-health-panel";
import { Users, ShieldCheck, History, AlertTriangle, UserCheck, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const lastUpdatedTime = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Execute database queries in parallel for peak performance
  const [
    totalPersons,
    activePersons,
    activeEmbeddings,
    totalAccess,
    grantedAccess,
    deniedAccess,
    todayTotalAccess,
    todayGrantedAccess,
    todayDeniedAccess,
    matchedRecognition,
    unknownRecognition,
    ambiguousRecognition,
    unresolvedAlertsCount,
    criticalAlertsCount,
    highAlertsCount,
    mediumAlertsCount,
    lowAlertsCount,
    qualityAggregate,
    similarityAggregate,
    latencyAggregate,
    rawRecentEvents,
    rawAlerts,
  ] = await Promise.all([
    prisma.person.count(),
    prisma.person.count({ where: { status: "active" } }),
    prisma.faceEmbedding.count({ where: { isActive: true } }),

    prisma.accessLog.count(),
    prisma.accessLog.count({ where: { accessStatus: "granted" } }),
    prisma.accessLog.count({ where: { accessStatus: "denied" } }),

    prisma.accessLog.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.accessLog.count({ where: { createdAt: { gte: startOfToday }, accessStatus: "granted" } }),
    prisma.accessLog.count({ where: { createdAt: { gte: startOfToday }, accessStatus: "denied" } }),

    prisma.accessLog.count({ where: { matchStatus: "matched" } }),
    prisma.accessLog.count({ where: { matchStatus: "unknown" } }),
    prisma.accessLog.count({ where: { matchStatus: "ambiguous" } }),

    prisma.alert.count({ where: { resolved: false } }),
    prisma.alert.count({ where: { resolved: false, severity: "critical" } }),
    prisma.alert.count({ where: { resolved: false, severity: "high" } }),
    prisma.alert.count({ where: { resolved: false, severity: "medium" } }),
    prisma.alert.count({ where: { resolved: false, severity: "low" } }),

    prisma.faceEmbedding.aggregate({
      _avg: { qualityScore: true },
    }),
    prisma.accessLog.aggregate({
      where: { confidenceScore: { gte: 0 } },
      _avg: { confidenceScore: true },
    }),
    prisma.accessLog.aggregate({
      _avg: { processingTimeMs: true },
    }),

    prisma.accessLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        person: { select: { id: true, personCode: true, firstName: true, lastName: true, category: true } },
        device: { select: { id: true, deviceName: true, serialNumber: true } },
      },
    }),

    prisma.alert.findMany({
      where: { resolved: false },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        person: { select: { id: true, personCode: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const avgQualityPct = qualityAggregate._avg.qualityScore ? qualityAggregate._avg.qualityScore * 100 : 0;
  const avgSimilarityPct = similarityAggregate._avg.confidenceScore ? similarityAggregate._avg.confidenceScore * 100 : 0;
  const avgLatencySec = latencyAggregate._avg.processingTimeMs ? latencyAggregate._avg.processingTimeMs / 1000 : 0;

  // Format events for client component
  const recentEvents: AccessEventItem[] = rawRecentEvents.map((evt) => ({
    id: evt.id,
    matchStatus: evt.matchStatus,
    accessStatus: evt.accessStatus,
    reason: evt.reason,
    doorAction: evt.doorAction,
    confidenceScore: evt.confidenceScore,
    processingTimeMs: evt.processingTimeMs,
    createdAt: evt.createdAt.toISOString(),
    person: evt.person,
    device: evt.device,
  }));

  const alerts: SecurityAlertItem[] = rawAlerts.map((alt) => ({
    id: alt.id,
    alertType: alt.alertType,
    title: alt.title,
    message: alt.message,
    severity: alt.severity as any,
    resolved: alt.resolved,
    createdAt: alt.createdAt.toISOString(),
    person: alt.person,
  }));

  const countsBySeverity = {
    critical: criticalAlertsCount,
    high: highAlertsCount,
    medium: mediumAlertsCount,
    low: lowAlertsCount,
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-background text-foreground">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Security Overview</h1>
          <p className="text-sm text-muted-foreground">
            Real-time biometric access control telemetry, recognition analytics, and system health.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto font-mono text-xs text-muted-foreground">
          <span>Last updated: {lastUpdatedTime}</span>
        </div>
      </div>

      {/* 2. Full-Width Horizontal System Service Health Panel */}
      <div className="w-full">
        <SystemHealthPanel />
      </div>

      {/* 3. KPI Cards Row (6 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Registered"
          value={totalPersons}
          icon={<Users className="w-4 h-4" />}
          description="Registered individuals"
          variant="primary"
        />
        <StatCard
          title="Active Persons"
          value={activePersons}
          icon={<UserCheck className="w-4 h-4" />}
          description={`${activeEmbeddings} active face embeddings`}
          variant="emerald"
        />
        <StatCard
          title="Today's Attempts"
          value={todayTotalAccess}
          icon={<History className="w-4 h-4" />}
          description="Access attempts today"
          variant="purple"
        />
        <StatCard
          title="Access Granted Today"
          value={todayGrantedAccess}
          icon={<ShieldCheck className="w-4 h-4" />}
          description="Successful door unlocks"
          variant="emerald"
        />
        <StatCard
          title="Access Denied Today"
          value={todayDeniedAccess}
          icon={<AlertTriangle className="w-4 h-4" />}
          description="Access attempts blocked"
          variant="destructive"
        />
        <StatCard
          title="Active Alerts"
          value={unresolvedAlertsCount}
          icon={<ShieldAlert className="w-4 h-4" />}
          description="Unresolved security items"
          variant="amber"
        />
      </div>

      {/* 4. Decision Analytics & Recognition Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccessOverviewChart
          total={totalAccess}
          granted={grantedAccess}
          denied={deniedAccess}
          todayTotal={todayTotalAccess}
          todayGranted={todayGrantedAccess}
          todayDenied={todayDeniedAccess}
        />
        <RecognitionBreakdown
          matched={matchedRecognition}
          unknown={unknownRecognition}
          ambiguous={ambiguousRecognition}
          avgQuality={avgQualityPct}
          avgSimilarity={avgSimilarityPct}
          avgLatencySec={avgLatencySec}
        />
      </div>

      {/* 5. Recent Access Events */}
      <div className="space-y-6">
        <RecentAccessTable events={recentEvents} />
      </div>

      {/* 6. Unresolved Security Alerts Panel */}
      <div className="w-full">
        <SecurityAlertsPanel alerts={alerts} countsBySeverity={countsBySeverity} />
      </div>
    </div>
  );
}