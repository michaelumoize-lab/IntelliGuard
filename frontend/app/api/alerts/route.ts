import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { AlertType, Severity } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
    const type = (searchParams.get("type") || "").trim();
    const severity = (searchParams.get("severity") || "").trim().toLowerCase();
    const resolvedParam = searchParams.get("resolved");

    const where: Prisma.AlertWhereInput = {};

    if (type) {
      if (!Object.values(AlertType).includes(type as AlertType)) {
        return NextResponse.json(
          { error: "INVALID_ALERT_TYPE", message: `Invalid alert type: ${type}` },
          { status: 400 }
        );
      }
      where.alertType = type as AlertType;
    }

    if (severity && ["low", "medium", "high", "critical"].includes(severity)) {
      where.severity = severity as Severity;
    }

    if (resolvedParam === "true") {
      where.resolved = true;
    } else if (resolvedParam === "false") {
      where.resolved = false;
    }

    const total = await prisma.alert.count({ where });
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const alerts = await prisma.alert.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        device: {
          select: {
            id: true,
            deviceName: true,
            serialNumber: true,
            location: true,
          },
        },
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
    });

    return NextResponse.json({
      success: true,
      alerts,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: unknown) {
    console.error("Failed to retrieve alerts:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to retrieve security alerts." },
      { status: 500 }
    );
  }
}
