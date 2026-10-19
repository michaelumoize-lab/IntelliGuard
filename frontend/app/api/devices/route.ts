import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import { DeviceType, DeviceStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface CreateDeviceBody {
  deviceName?: string;
  serialNumber?: string;
  location?: string;
  ipAddress?: string;
  firmwareVersion?: string;
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

export async function GET(req: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (authCheck.error) return authCheck.error;

  const url = new URL(req.url);
  const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const rawLimit = parseInt(url.searchParams.get("limit") || "10", 10);
  const limit = Math.max(1, Math.min(100, isNaN(rawLimit) ? 10 : rawLimit));
  const search = (url.searchParams.get("search") || "").trim();
  const statusParam = url.searchParams.get("status") || "";
  const typeParam = url.searchParams.get("deviceType") || "";

  const whereClause: Prisma.DeviceWhereInput = {};

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
  } catch (error: unknown) {
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
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch (_) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Invalid JSON request body." },
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
    const requiredStringFields = ["deviceName", "serialNumber", "location"] as const;
    for (const field of requiredStringFields) {
      if (body[field] !== undefined && typeof body[field] !== "string") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Field '${field}' must be a string.` },
          { status: 400 }
        );
      }
    }

    const optionalStringOrNullFields = ["ipAddress", "firmwareVersion"] as const;
    for (const field of optionalStringOrNullFields) {
      if (body[field] !== undefined && body[field] !== null && typeof body[field] !== "string") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Field '${field}' must be a string or null.` },
          { status: 400 }
        );
      }
    }

    const optionalStringFields = ["deviceType", "status"] as const;
    for (const field of optionalStringFields) {
      if (body[field] !== undefined && typeof body[field] !== "string") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Field '${field}' must be a string.` },
          { status: 400 }
        );
      }
    }

    const deviceName = (typeof body.deviceName === "string" ? body.deviceName : "").trim();
    const serialNumber = (typeof body.serialNumber === "string" ? body.serialNumber : "").trim();
    const location = (typeof body.location === "string" ? body.location : "").trim();
    const ipAddress = typeof body.ipAddress === "string" && body.ipAddress.trim() ? body.ipAddress.trim() : null;
    const firmwareVersion =
      typeof body.firmwareVersion === "string" && body.firmwareVersion.trim() ? body.firmwareVersion.trim() : null;
    const deviceType = (typeof body.deviceType === "string" ? body.deviceType : "camera").trim().toLowerCase();
    const status = (typeof body.status === "string" ? body.status : "offline").trim().toLowerCase();

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

    let newDevice;
    try {
      newDevice = await prisma.device.create({
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
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Serial number '${serialNumber}' is already registered.` },
          { status: 409 }
        );
      }
      throw err;
    }

    const { apiKeyHash: _, ...safeDevice } = newDevice;

    return NextResponse.json(
      {
        success: true,
        device: safeDevice,
        apiKey: rawApiKey,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Error in POST /api/devices:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to create device." },
      { status: 500 }
    );
  }
}
