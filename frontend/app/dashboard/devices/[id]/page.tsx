import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { DeviceHealthCard } from "@/components/devices/device-health-card";
import { DeviceAccessSummary } from "@/components/devices/device-access-summary";
import { DeviceAlerts } from "@/components/devices/device-alerts";
import { DeviceDetailHeaderActions } from "@/components/devices/devices-client-actions";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const deviceId = parseInt(resolvedParams.id, 10);

  if (isNaN(deviceId)) {
    notFound();
  }

  // Fetch device profile directly from PostgreSQL via Prisma
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    notFound();
  }

  const { apiKeyHash: _, ...safeDevice } = device;

  // Calculate start of today (UTC)
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Execute queries in parallel for optimal response times
  const [
    totalAccessAttempts,
    grantedAttempts,
    deniedAttempts,
    todayAttempts,
    todayGranted,
    todayDenied,
    unresolvedAlerts,
    recentLogsRaw,
    recentAlertsRaw,
  ] = await Promise.all([
    prisma.accessLog.count({ where: { deviceId } }),
    prisma.accessLog.count({ where: { deviceId, accessStatus: "granted" } }),
    prisma.accessLog.count({ where: { deviceId, accessStatus: "denied" } }),
    prisma.accessLog.count({ where: { deviceId, createdAt: { gte: startOfToday } } }),
    prisma.accessLog.count({ where: { deviceId, accessStatus: "granted", createdAt: { gte: startOfToday } } }),
    prisma.accessLog.count({ where: { deviceId, accessStatus: "denied", createdAt: { gte: startOfToday } } }),
    prisma.alert.count({ where: { deviceId, resolved: false } }),

    prisma.accessLog.findMany({
      where: { deviceId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        person: {
          select: {
            id: true,
            personCode: true,
            firstName: true,
            lastName: true,
            category: true,
          },
        },
      },
    }),

    prisma.alert.findMany({
      where: { deviceId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  const stats = {
    totalAccessAttempts,
    grantedAttempts,
    deniedAttempts,
    todayAttempts,
    todayGranted,
    todayDenied,
    unresolvedAlerts,
  };

  const recentLogs = recentLogsRaw.map((log) => ({
    id: log.id,
    timestamp: log.createdAt.toISOString(),
    person: log.person,
    matchStatus: log.matchStatus,
    accessStatus: log.accessStatus,
    reason: log.reason,
    confidenceScore: log.confidenceScore,
    processingTimeMs: log.processingTimeMs,
  }));

  const recentAlerts = recentAlertsRaw.map((alt) => ({
    id: alt.id,
    alertType: alt.alertType,
    title: alt.title,
    message: alt.message,
    severity: alt.severity,
    resolved: alt.resolved,
    createdAt: alt.createdAt.toISOString(),
    resolvedAt: alt.resolvedAt ? alt.resolvedAt.toISOString() : null,
    person: alt.person,
  }));

  const serializableDevice = {
    ...safeDevice,
    lastSeen: safeDevice.lastSeen ? safeDevice.lastSeen.toISOString() : null,
    createdAt: safeDevice.createdAt.toISOString(),
    updatedAt: safeDevice.updatedAt.toISOString(),
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-4 sm:space-y-6 bg-background text-foreground">
      {/* Navigation & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href="/dashboard/devices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>{device.deviceName}</span>
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Serial: <span className="font-mono text-foreground font-medium">{device.serialNumber}</span> • Registered {new Date(device.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Profile & Health Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DeviceDetailHeaderActions device={serializableDevice} />
        </div>
        <div>
          <DeviceHealthCard status={device.status} lastSeen={serializableDevice.lastSeen} />
        </div>
      </div>

      {/* Access Event Metrics & Logs */}
      <DeviceAccessSummary stats={stats} recentLogs={recentLogs} deviceId={device.id} />

      {/* Security Alerts */}
      <DeviceAlerts alerts={recentAlerts} deviceId={device.id} />
    </div>
  );
}
