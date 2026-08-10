import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Explicit reporting timezone (UTC local midnight boundary)
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    // Parallel grouped aggregations and metric averages
    const [
      personStatusGroups,
      totalEmbeddings,
      activeEmbeddings,
      accessStatusGroups,
      todayAccessStatusGroups,
      matchStatusGroups,
      alertSeverityGroups,
      qualityAggregate,
      similarityAggregate,
      latencyAggregate,
    ] = await Promise.all([
      prisma.person.groupBy({
        by: ["status"],
        _count: true,
      }),

      prisma.faceEmbedding.count(),
      prisma.faceEmbedding.count({ where: { isActive: true } }),

      prisma.accessLog.groupBy({
        by: ["accessStatus"],
        _count: true,
      }),

      prisma.accessLog.groupBy({
        by: ["accessStatus"],
        where: { createdAt: { gte: startOfToday } },
        _count: true,
      }),

      prisma.accessLog.groupBy({
        by: ["matchStatus"],
        _count: true,
      }),

      prisma.alert.groupBy({
        by: ["severity"],
        where: { resolved: false },
        _count: true,
      }),

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
    ]);

    // Derive person breakdown values
    const personMap = new Map(personStatusGroups.map((g) => [g.status, g._count]));
    const activePersons = personMap.get("active") || 0;
    const inactivePersons = personMap.get("inactive") || 0;
    const suspendedPersons = personMap.get("suspended") || 0;
    const totalPersons = activePersons + inactivePersons + suspendedPersons;

    // Derive access breakdown values
    const accessMap = new Map(accessStatusGroups.map((g) => [g.accessStatus, g._count]));
    const grantedAccess = accessMap.get("granted") || 0;
    const deniedAccess = accessMap.get("denied") || 0;
    const totalAccess = grantedAccess + deniedAccess;

    // Derive today's access breakdown values
    const todayAccessMap = new Map(todayAccessStatusGroups.map((g) => [g.accessStatus, g._count]));
    const todayGrantedAccess = todayAccessMap.get("granted") || 0;
    const todayDeniedAccess = todayAccessMap.get("denied") || 0;
    const todayTotalAccess = todayGrantedAccess + todayDeniedAccess;

    // Derive recognition breakdown values
    const matchMap = new Map(matchStatusGroups.map((g) => [g.matchStatus, g._count]));
    const matchedRecognition = matchMap.get("matched") || 0;
    const unknownRecognition = matchMap.get("unknown") || 0;
    const ambiguousRecognition = matchMap.get("ambiguous") || 0;

    // Derive alert severity breakdown values
    const alertMap = new Map(alertSeverityGroups.map((g) => [g.severity, g._count]));
    const criticalAlerts = alertMap.get("critical") || 0;
    const highAlerts = alertMap.get("high") || 0;
    const mediumAlerts = alertMap.get("medium") || 0;
    const lowAlerts = alertMap.get("low") || 0;
    const unresolvedAlerts = criticalAlerts + highAlerts + mediumAlerts + lowAlerts;
    const totalAlertsCount = await prisma.alert.count();

    const avgQualityPct = qualityAggregate._avg.qualityScore ? qualityAggregate._avg.qualityScore * 100 : 0;
    const avgSimilarityPct = similarityAggregate._avg.confidenceScore ? similarityAggregate._avg.confidenceScore * 100 : 0;
    const avgLatencySec = latencyAggregate._avg.processingTimeMs ? latencyAggregate._avg.processingTimeMs / 1000 : 0;

    return NextResponse.json({
      success: true,
      persons: {
        total: totalPersons,
        active: activePersons,
        inactive: inactivePersons,
        suspended: suspendedPersons,
      },
      embeddings: {
        total: totalEmbeddings,
        active: activeEmbeddings,
      },
      access: {
        total: totalAccess,
        granted: grantedAccess,
        denied: deniedAccess,
        todayTotal: todayTotalAccess,
        todayGranted: todayGrantedAccess,
        todayDenied: todayDeniedAccess,
      },
      recognition: {
        matched: matchedRecognition,
        unknown: unknownRecognition,
        ambiguous: ambiguousRecognition,
        avgQuality: Number(avgQualityPct.toFixed(1)),
        avgSimilarity: Number(avgSimilarityPct.toFixed(1)),
        avgLatencySec: Number(avgLatencySec.toFixed(2)),
      },
      alerts: {
        total: totalAlertsCount,
        unresolved: unresolvedAlerts,
        critical: criticalAlerts,
        high: highAlerts,
        medium: mediumAlerts,
        low: lowAlerts,
      },
    });
  } catch (error: any) {
    console.error("Failed to calculate dashboard statistics:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to calculate dashboard statistics." },
      { status: 500 }
    );
  }
}
