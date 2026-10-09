import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import { authenticateDevice } from "@/lib/access/device-auth";
import {
  getDeviceTelemetry,
  recordDeviceHeartbeat,
  isDeviceOnline,
  HEARTBEAT_TIMEOUT_MS,
} from "@/lib/devices/device-telemetry";

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

/**
 * GET /api/devices/[id]/health
 * Returns true real-time hardware telemetry and connectivity status.
 */
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
      select: {
        id: true,
        deviceName: true,
        serialNumber: true,
        status: true,
        location: true,
        ipAddress: true,
        firmwareVersion: true,
        lastSeen: true,
      },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Device not found." },
        { status: 404 }
      );
    }

    const liveOnline = isDeviceOnline(device.lastSeen);
    const telemetry = getDeviceTelemetry(deviceId);

    // If device was recorded as online but has not sent a heartbeat within threshold, update status
    let currentStatus = device.status;
    if (!liveOnline && device.status === "online") {
      currentStatus = "offline";
      prisma.device
        .update({ where: { id: device.id }, data: { status: "offline" } })
        .catch((err) => console.error("Failed to mark expired device offline:", err));
    }

    return NextResponse.json({
      success: true,
      deviceId: device.id,
      deviceName: device.deviceName,
      serialNumber: device.serialNumber,
      status: currentStatus,
      hardwareConnected: liveOnline,
      hardwareTelemetryAvailable: liveOnline,
      lastSeen: device.lastSeen,
      ipAddress: telemetry?.ipAddress || device.ipAddress,
      firmwareVersion: telemetry?.firmwareVersion || device.firmwareVersion || "v1.0.0",
      telemetry: liveOnline && telemetry
        ? {
            wifiRssi: telemetry.wifiRssi,
            freeHeapBytes: telemetry.freeHeapBytes,
            uptimeSeconds: telemetry.uptimeSeconds,
            doorState: telemetry.doorState || "locked",
            lastPing: new Date(telemetry.lastPing).toISOString(),
          }
        : null,
      heartbeatWindowSeconds: Math.round(HEARTBEAT_TIMEOUT_MS / 1000),
      message: liveOnline
        ? "Hardware is actively connected and reporting real-time telemetry."
        : "Hardware is currently offline or unreachable. No recent heartbeat received.",
    });
  } catch (error: any) {
    console.error("Error in GET /api/devices/[id]/health:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to fetch device health." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/devices/[id]/health
 * Genuine device heartbeat endpoint called by physical ESP32 or terminal nodes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const deviceId = parseInt(idParam, 10);
  if (isNaN(deviceId)) {
    return NextResponse.json(
      { success: false, error: "VALIDATION_ERROR", message: "Invalid device ID." },
      { status: 400 }
    );
  }

  const apiKey = req.headers.get("x-api-key");
  const timestamp = req.headers.get("x-timestamp");
  const nonce = req.headers.get("x-nonce");

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED", message: "Device API key required in x-api-key header." },
      { status: 401 }
    );
  }

  const authResult = await authenticateDevice(deviceId, apiKey, { timestamp, nonce });
  if (!authResult.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: "AUTHENTICATION_FAILED",
        reason: authResult.reason,
        message: `Device authentication failed: ${authResult.reason || "invalid credentials"}.`,
      },
      { status: 401 }
    );
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty on simple ping
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      body.ip_address ||
      body.ipAddress;

    const firmwareVersion = body.firmware_version || body.firmwareVersion;
    const wifiRssi = typeof body.wifi_rssi === "number" ? body.wifi_rssi : body.wifiRssi;
    const freeHeapBytes = typeof body.free_heap_bytes === "number" ? body.free_heap_bytes : body.freeHeapBytes;
    const uptimeSeconds = typeof body.uptime_seconds === "number" ? body.uptime_seconds : body.uptimeSeconds;
    const doorState = body.door_state || body.doorState || "locked";

    // Record live in-memory telemetry
    recordDeviceHeartbeat({
      deviceId,
      ipAddress: clientIp,
      firmwareVersion,
      wifiRssi,
      freeHeapBytes,
      uptimeSeconds,
      doorState,
      lastPing: Date.now(),
    });

    // Update persistent database record
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        status: "online",
        lastSeen: new Date(),
        ...(clientIp ? { ipAddress: clientIp } : {}),
        ...(firmwareVersion ? { firmwareVersion } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      acknowledged: true,
      deviceId,
      status: "online",
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Error processing device heartbeat:", err);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to record device heartbeat." },
      { status: 500 }
    );
  }
}
