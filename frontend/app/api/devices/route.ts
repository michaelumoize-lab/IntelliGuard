import crypto from "crypto";
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

export async function GET(req: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (authCheck.error) return authCheck.error;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "10", 10)));
  const search = (url.searchParams.get("search") || "").trim();
  const statusParam = url.searchParams.get("status") || "";
  const typeParam = url.searchParams.get("deviceType") || "";

  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { deviceName: { contains: search, mode: "insensitive" } },
      { serialNumber: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { ipAddress: { contains: search, mode: "insensitive" } },
    ];
  }

  if (statusParam && VALID_DEVICE_STATUSES.includes(statusParam as DeviceStatus)) {
    whereClause.status = statusParam as DeviceStatus;
  }

  if (typeParam && VALID_DEVICE_TYPES.includes(typeParam as DeviceType)) {
    whereClause.deviceType = typeParam as DeviceType;
  }

  try {
    const total = await prisma.device.count({ where: whereClause });
    const totalPages = Math.ceil(total / limit);

    const rawDevices = await prisma.device.findMany({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            accessLogs: true,
            alerts: true,
          },
        },
        accessLogs: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        },
      },
    });

    const data = rawDevices.map((device) => {
      const { apiKeyHash, accessLogs, _count, ...safeDevice } = device;
      return {
        ...safeDevice,
        accessLogCount: _count.accessLogs,
        alertCount: _count.alerts,
        lastAccessAt: accessLogs[0]?.createdAt || null,
      };
    });

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
  } catch (error: any) {
    console.error("Error in GET /api/devices:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to fetch devices." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (authCheck.error) return authCheck.error;

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (_) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const deviceName = (body.deviceName || "").trim();
    const serialNumber = (body.serialNumber || "").trim();
    const location = (body.location || "").trim();
    const ipAddress = body.ipAddress ? body.ipAddress.trim() : null;
    const firmwareVersion = body.firmwareVersion ? body.firmwareVersion.trim() : null;
    const deviceType = (body.deviceType || "camera").trim().toLowerCase();
    const status = (body.status || "offline").trim().toLowerCase();

    if (!deviceName || !serialNumber || !location) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Device name, serial number, and location are required." },
        { status: 400 }
      );
    }

    if (!VALID_DEVICE_TYPES.includes(deviceType as DeviceType)) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: `Invalid deviceType '${deviceType}'. Must be one of: ${VALID_DEVICE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!VALID_DEVICE_STATUSES.includes(status as DeviceStatus)) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: `Invalid status '${status}'. Must be one of: ${VALID_DEVICE_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Check unique serial number
    const existing = await prisma.device.findUnique({
      where: { serialNumber },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: `Serial number '${serialNumber}' is already registered.` },
        { status: 400 }
      );
    }

    // Generate cryptographically secure API key
    const rawApiKey = `ig_dev_${crypto.randomBytes(24).toString("hex")}`;
    const apiKeyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");

    const newDevice = await prisma.device.create({
      data: {
        deviceName,
        serialNumber,
        location,
        ipAddress,
        firmwareVersion,
        deviceType: deviceType as DeviceType,
        status: status as DeviceStatus,
        apiKeyHash,
      },
    });

    const { apiKeyHash: _, ...safeDevice } = newDevice;

    return NextResponse.json(
      {
        success: true,
        device: safeDevice,
        apiKey: rawApiKey,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/devices:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to create device." },
      { status: 500 }
    );
  }
}
