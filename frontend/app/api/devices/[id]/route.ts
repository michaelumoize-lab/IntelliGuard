import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import { DeviceType, DeviceStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface UpdateDeviceBody {
  id?: unknown;
  serialNumber?: unknown;
  apiKeyHash?: unknown;
  createdAt?: unknown;
  deviceName?: string;
  location?: string;
  ipAddress?: string | null;
  firmwareVersion?: string | null;
  deviceType?: string;
  status?: string;
}

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
  } catch (error: unknown) {
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

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch (_) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Invalid JSON body." },
        { status: 400 }
      );
    }

    if (
      !rawBody ||
      typeof rawBody !== "object" ||
      Array.isArray(rawBody) ||
      Object.getPrototypeOf(rawBody) !== Object.prototype
    ) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const body = rawBody as Record<string, unknown>;

    // Explicitly disallow modifying id, serialNumber, apiKeyHash, createdAt
    if ("id" in body || "serialNumber" in body || "apiKeyHash" in body || "createdAt" in body) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Cannot modify protected fields (id, serialNumber, apiKeyHash, createdAt)." },
        { status: 400 }
      );
    }

    const updateData: Prisma.DeviceUpdateInput = {};

    if (body.deviceName !== undefined) {
      if (typeof body.deviceName !== "string") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Field 'deviceName' must be a string." },
          { status: 400 }
        );
      }
      const name = body.deviceName.trim();
      if (!name) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Device name cannot be empty." },
          { status: 400 }
        );
      }
      updateData.deviceName = name;
    }

    if (body.location !== undefined) {
      if (typeof body.location !== "string") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Field 'location' must be a string." },
          { status: 400 }
        );
      }
      const loc = body.location.trim();
      if (!loc) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Location cannot be empty." },
          { status: 400 }
        );
      }
      updateData.location = loc;
    }

    if (body.ipAddress !== undefined) {
      if (body.ipAddress !== null && typeof body.ipAddress !== "string") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Field 'ipAddress' must be a string or null." },
          { status: 400 }
        );
      }
      updateData.ipAddress = typeof body.ipAddress === "string" && body.ipAddress.trim() ? body.ipAddress.trim() : null;
    }

    if (body.firmwareVersion !== undefined) {
      if (body.firmwareVersion !== null && typeof body.firmwareVersion !== "string") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Field 'firmwareVersion' must be a string or null." },
          { status: 400 }
        );
      }
      updateData.firmwareVersion =
        typeof body.firmwareVersion === "string" && body.firmwareVersion.trim() ? body.firmwareVersion.trim() : null;
    }

    if (body.deviceType !== undefined) {
      if (typeof body.deviceType !== "string") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Field 'deviceType' must be a string." },
          { status: 400 }
        );
      }
      const type = body.deviceType.trim().toLowerCase();
      if (!VALID_DEVICE_TYPES.includes(type as DeviceType)) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Invalid deviceType '${type}'. Must be one of: ${VALID_DEVICE_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.deviceType = type as DeviceType;
    }

    if (body.status !== undefined) {
      if (typeof body.status !== "string") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: "Field 'status' must be a string." },
          { status: 400 }
        );
      }
      const stat = body.status.trim().toLowerCase();
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    console.error("Error in DELETE /api/devices/[id]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to delete device." },
      { status: 500 }
    );
  }
}
