import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import type { Prisma } from "@prisma/client";
import { Severity, AlertType } from "@prisma/client";

export const dynamic = "force-dynamic";

async function checkAdminAuth() {
  const session = await getServerSession();
  if (!session || !session.user) {
    return { error: NextResponse.json({ success: false, error: "UNAUTHORIZED", message: "Authentication required." }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "admin") {
    return { error: NextResponse.json({ success: false, error: "FORBIDDEN", message: "Admin authorization required." }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth();
  if (authCheck.error) return authCheck.error;

  const { id: idParam } = await params;
  const deviceId = parseInt(idParam, 10);
  if (isNaN(deviceId)) {
    return NextResponse.json(
      { success: false, error: "VALIDATION_ERROR", message: "Invalid device ID." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const rawLimit = parseInt(url.searchParams.get("limit") || "10", 10);
  const limit = Math.max(1, Math.min(100, isNaN(rawLimit) ? 10 : rawLimit));
  const severity = url.searchParams.get("severity");
  const alertType = url.searchParams.get("alertType");
  const resolvedParam = url.searchParams.get("resolved");

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Device not found." },
        { status: 404 }
      );
    }

    const whereClause: Prisma.AlertWhereInput = { deviceId };

    if (severity) {
      if (!Object.values(Severity).includes(severity as Severity)) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Invalid severity: ${severity}` },
          { status: 400 }
        );
      }
      whereClause.severity = severity as Severity;
    }

    if (alertType) {
      if (!Object.values(AlertType).includes(alertType as AlertType)) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Invalid alert type: ${alertType}` },
          { status: 400 }
        );
      }
      whereClause.alertType = alertType as AlertType;
    }

    if (resolvedParam !== null && resolvedParam !== undefined && resolvedParam !== "") {
      whereClause.resolved = resolvedParam === "true";
    }

    const total = await prisma.alert.count({ where: whereClause });
    const totalPages = Math.ceil(total / limit);

    const alertsRaw = await prisma.alert.findMany({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        person: {
          select: {
            id: true,
            personCode: true,
            firstName: true,
            lastName: true,
            faceImageUrl: true,
          },
        },
      },
    });

    const data = alertsRaw.map((alert) => ({
      id: alert.id,
      alertType: alert.alertType,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      resolved: alert.resolved,
      resolvedBy: alert.resolvedBy,
      resolvedAt: alert.resolvedAt,
      createdAt: alert.createdAt,
      person: alert.person,
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/devices/[id]/alerts:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to fetch device alerts." },
      { status: 500 }
    );
  }
}
