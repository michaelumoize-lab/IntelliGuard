import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import { DeviceType, DeviceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_DEVICE_TYPES = Object.values(DeviceType);
const VALID_DEVICE_STATUSES = Object.values(DeviceStatus);

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

  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Device not found." },
        { status: 404 }
      );
    }

    const { apiKeyHash: _, ...safeDevice } = device;

    // Calculate start of today (UTC)
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Aggregate statistics
    const [
      totalAccessAttempts,
      grantedAttempts,
      deniedAttempts,
      todayAttempts,
      todayGranted,
      todayDenied,
      unresolvedAlerts,
    ] = await Promise.all([
      prisma.accessLog.count({ where: { deviceId } }),
      prisma.accessLog.count({ where: { deviceId, accessStatus: "granted" } }),
      prisma.accessLog.count({ where: { deviceId, accessStatus: "denied" } }),
      prisma.accessLog.count({ where: { deviceId, createdAt: { gte: startOfToday } } }),
      prisma.accessLog.count({ where: { deviceId, accessStatus: "granted", createdAt: { gte: startOfToday } } }),
      prisma.accessLog.count({ where: { deviceId, accessStatus: "denied", createdAt: { gte: startOfToday } } }),
      prisma.alert.count({ where: { deviceId, resolved: false } }),
    ]);

    // Fetch recent logs
    const recentLogsRaw = await prisma.accessLog.findMany({
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
            department: true,
            faceImageUrl: true,
          },
        },
      },
    });

    // Clean logs to guarantee NO raw embeddings are exposed
    const recentLogs = recentLogsRaw.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      person: log.person,
      matchStatus: log.matchStatus,
      accessStatus: log.accessStatus,
      reason: log.reason,
      doorAction: log.doorAction,
      confidenceScore: log.confidenceScore,
      processingTimeMs: log.processingTimeMs,
    }));

    // Fetch recent alerts
    const recentAlerts = await prisma.alert.findMany({
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
    });

    return NextResponse.json({
      success: true,
      device: safeDevice,
      stats: {
        totalAccessAttempts,
        grantedAttempts,
        deniedAttempts,
        todayAttempts,
        todayGranted,
        todayDenied,
        unresolvedAlerts,
      },
      recentLogs,
      recentAlerts,
    });
  } catch (error: any) {
    console.error("Error in GET /api/devices/[id]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to fetch device details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

  try {
    const existing = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Device not found." },
        { status: 404 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch (_) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Invalid JSON body." },
        { status: 400 }
      );
    }

    // Explicitly disallow modifying id, serialNumber, apiKeyHash, createdAt
    if ("id" in body || "serialNumber" in body || "apiKeyHash" in body || "createdAt" in body) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Cannot modify protected fields (id, serialNumber, apiKeyHash, createdAt)." },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (body.deviceName !== undefined) {
      const name = (body.deviceName || "").trim();
      if (!name) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Device name cannot be empty." },
          { status: 400 }
        );
      }
      updateData.deviceName = name;
    }

    if (body.location !== undefined) {
      const loc = (body.location || "").trim();
      if (!loc) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Location cannot be empty." },
          { status: 400 }
        );
      }
      updateData.location = loc;
    }

    if (body.ipAddress !== undefined) {
      updateData.ipAddress = body.ipAddress ? body.ipAddress.trim() : null;
    }

    if (body.firmwareVersion !== undefined) {
      updateData.firmwareVersion = body.firmwareVersion ? body.firmwareVersion.trim() : null;
    }

    if (body.deviceType !== undefined) {
      const type = (body.deviceType || "").trim().toLowerCase();
      if (!VALID_DEVICE_TYPES.includes(type as DeviceType)) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Invalid deviceType '${type}'. Must be one of: ${VALID_DEVICE_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.deviceType = type as DeviceType;
    }

    if (body.status !== undefined) {
      const stat = (body.status || "").trim().toLowerCase();
      if (!VALID_DEVICE_STATUSES.includes(stat as DeviceStatus)) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Invalid status '${stat}'. Must be one of: ${VALID_DEVICE_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.status = stat as DeviceStatus;
    }

    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: updateData,
    });

    const { apiKeyHash: _, ...safeDevice } = updatedDevice;

    return NextResponse.json({
      success: true,
      device: safeDevice,
    });
  } catch (error: any) {
    console.error("Error in PATCH /api/devices/[id]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to update device." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

  try {
    const existing = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Device not found." },
        { status: 404 }
      );
    }

    // Delete device. Prisma `onDelete: SetNull` preserves historical AccessLogs and Alerts
    await prisma.device.delete({
      where: { id: deviceId },
    });

    return NextResponse.json({
      success: true,
      message: "Device deleted successfully. Historical access logs and alerts have been preserved.",
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/devices/[id]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to delete device." },
      { status: 500 }
    );
  }
}
