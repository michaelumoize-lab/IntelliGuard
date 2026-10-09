import React from "react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/dashboard/stat-card";
import { AccessOverviewChart } from "@/components/dashboard/access-overview-chart";
import { RecognitionBreakdown } from "@/components/dashboard/recognition-breakdown";
import { RecentAccessTable, AccessEventItem } from "@/components/dashboard/recent-access-table";
import { SecurityAlertsPanel, SecurityAlertItem } from "@/components/dashboard/security-alerts-panel";
import { SystemHealthPanel } from "@/components/dashboard/system-health-panel";
import { DashboardLiveRefresh } from "@/components/dashboard/dashboard-live-refresh";
import { Users, ShieldCheck, History, AlertTriangle, UserCheck, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const lastUpdatedIso = new Date().toISOString();

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
    rawTodayLogs,
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

    prisma.accessLog.findMany({
      where: { createdAt: { gte: startOfToday } },
      select: { createdAt: true, accessStatus: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const avgQualityPct = qualityAggregate._avg.qualityScore ? qualityAggregate._avg.qualityScore * 100 : 0;
  const avgSimilarityPct = similarityAggregate._avg.confidenceScore ? similarityAggregate._avg.confidenceScore * 100 : 0;
  const avgLatencySec = latencyAggregate._avg.processingTimeMs ? latencyAggregate._avg.processingTimeMs / 1000 : 0;

  // Bucket today's access attempts into 4-hour slots for timeline area chart
  const hoursMap: Record<string, { time: string; granted: number; denied: number }> = {
    "00:00": { time: "00:00", granted: 0, denied: 0 },
    "04:00": { time: "04:00", granted: 0, denied: 0 },
    "08:00": { time: "08:00", granted: 0, denied: 0 },
    "12:00": { time: "12:00", granted: 0, denied: 0 },
    "16:00": { time: "16:00", granted: 0, denied: 0 },
    "20:00": { time: "20:00", granted: 0, denied: 0 },
  };

  rawTodayLogs.forEach((log) => {
    const h = new Date(log.createdAt).getHours();
    let slot = "00:00";
    if (h >= 20) slot = "20:00";
    else if (h >= 16) slot = "16:00";
    else if (h >= 12) slot = "12:00";
    else if (h >= 8) slot = "08:00";
    else if (h >= 4) slot = "04:00";

    if (log.accessStatus === "granted") hoursMap[slot].granted++;
    else hoursMap[slot].denied++;
  });

  const hourlyData = Object.values(hoursMap);

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
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-background text-foreground">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Security Overview</h1>
          <p className="text-sm text-muted-foreground">
            Real-time biometric access control telemetry, recognition analytics, and system health.
          </p>
        </div>
        <DashboardLiveRefresh initialTimestamp={lastUpdatedIso} />
      </div>

      {/* 2. Full-Width Horizontal System Service Health Panel */}
      <div className="w-full">
        <SystemHealthPanel />
      </div>

      {/* 3. KPI Cards Row (6 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <AccessOverviewChart
          total={totalAccess}
          granted={grantedAccess}
          denied={deniedAccess}
          todayTotal={todayTotalAccess}
          todayGranted={todayGrantedAccess}
          todayDenied={todayDeniedAccess}
          hourlyData={hourlyData}
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