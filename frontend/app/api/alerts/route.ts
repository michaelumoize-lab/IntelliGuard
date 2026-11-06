import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import { isValidAlertCode, isValidDeviceCode } from "@/lib/identifiers";
import { Prisma, AlertType, Severity } from "@prisma/client";

export const dynamic = "force-dynamic";

async function checkAdminAuth() {
  const session = await getServerSession();
  if (!session || !session.user) {
    return {
      error: NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      ),
    };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "admin") {
    return {
      error: NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Admin authorization required." },
        { status: 403 }
      ),
    };
  }
  return { session };
}

export async function GET(req: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (authCheck.error) return authCheck.error;

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
          { success: false, error: "INVALID_ALERT_TYPE", message: "Invalid alert type parameter." },
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

    const alertsRaw = await prisma.alert.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        device: {
          select: {
            deviceCode: true,
            deviceName: true,
            serialNumber: true,
            location: true,
          },
        },
        person: {
          select: {
            personCode: true,
            firstName: true,
            lastName: true,
            category: true,
          },
        },
      },
    });

    const alerts = alertsRaw.map((alert) => ({
      ...alert,
      id: alert.alertCode,
      alertCode: alert.alertCode,
      device: alert.device
        ? {
            ...alert.device,
            id: alert.device.deviceCode,
            deviceCode: alert.device.deviceCode,
          }
        : null,
      person: alert.person
        ? {
            ...alert.person,
            id: alert.person.personCode,
            personCode: alert.person.personCode,
          }
        : null,
    }));

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

export async function PATCH(req: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const body = await req.json().catch(() => ({}));
    const resolvedValue = body.resolved !== undefined ? Boolean(body.resolved) : true;
    const resolvedByUserId =
      resolvedValue && typeof authCheck.session.user.id === "string" && authCheck.session.user.id.trim()
        ? authCheck.session.user.id
        : null;

    const where: Prisma.AlertWhereInput = {};
    if (resolvedValue) {
      where.resolved = false;
    } else {
      where.resolved = true;
    }

    const rawAlertCodes = Array.isArray(body.alertCodes)
      ? body.alertCodes
      : Array.isArray(body.alertIds)
        ? body.alertIds
        : null;

    if (rawAlertCodes && rawAlertCodes.length > 0) {
      const validAlertCodes = rawAlertCodes
        .map((id: unknown) => String(id))
        .filter((id: string) => isValidAlertCode(id));
      if (validAlertCodes.length === 0) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Invalid alert code(s). Expected format ALT-XXXXXX." },
          { status: 400 }
        );
      }
      where.alertCode = { in: validAlertCodes };
    }

    const rawDeviceCode = body.deviceCode ?? body.deviceId;
    if (rawDeviceCode) {
      const devCodeStr = String(rawDeviceCode);
      if (!isValidDeviceCode(devCodeStr)) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Invalid deviceCode. Expected format DEV-XXXXXX." },
          { status: 400 }
        );
      }
      where.deviceCode = devCodeStr;
    }

    let updateResult;
    try {
      updateResult = await prisma.alert.updateMany({
        where,
        data: {
          resolved: resolvedValue,
          resolvedAt: resolvedValue ? new Date() : null,
          resolvedBy: resolvedByUserId,
        },
      });
    } catch (updateErr: unknown) {
      if (
        resolvedByUserId &&
        updateErr instanceof Prisma.PrismaClientKnownRequestError &&
        updateErr.code === "P2003"
      ) {
        updateResult = await prisma.alert.updateMany({
          where,
          data: {
            resolved: resolvedValue,
            resolvedAt: resolvedValue ? new Date() : null,
            resolvedBy: null,
          },
        });
      } else {
        throw updateErr;
      }
    }

    return NextResponse.json({
      success: true,
      count: updateResult.count,
      message: `Successfully updated ${updateResult.count} alert${updateResult.count === 1 ? "" : "s"}.`,
    });
  } catch (error: unknown) {
    console.error("Failed to update alerts:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to update alerts." },
      { status: 500 }
    );
  }
}
