import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Parallel database aggregations for performance
    const [
      totalPersons,
      activePersons,
      inactivePersons,
      suspendedPersons,
      totalEmbeddings,
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
      totalAlerts,
      unresolvedAlerts,
      criticalAlerts,
      highAlerts,
      mediumAlerts,
      lowAlerts,
      qualityAggregate,
      similarityAggregate,
      latencyAggregate,
    ] = await Promise.all([
      prisma.person.count(),
      prisma.person.count({ where: { status: "active" } }),
      prisma.person.count({ where: { status: "inactive" } }),
      prisma.person.count({ where: { status: "suspended" } }),

      prisma.faceEmbedding.count(),
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

      prisma.alert.count(),
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
    ]);

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
        total: totalAlerts,
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
