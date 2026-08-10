import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";

export const dynamic = "force-dynamic";

const VALID_REASONS = [
  "face_match",
  "face_no_match",
  "insufficient_confidence",
  "time_restriction",
  "manual_override",
  "system_error",
];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user || (session.user.role !== "ADMIN" && session.user.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Admin authorization required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = (searchParams.get("search") || "").trim();
    const status = (searchParams.get("status") || "").trim().toLowerCase();
    const matchStatus = (searchParams.get("matchStatus") || "").trim().toLowerCase();
    const reason = (searchParams.get("reason") || "").trim().toLowerCase();
    const deviceIdParam = searchParams.get("deviceId");
    const personIdParam = searchParams.get("personId");

    const where: any = {};

    if (status && ["granted", "denied"].includes(status)) {
      where.accessStatus = status;
    }

    if (matchStatus && ["matched", "unknown", "ambiguous", "rejected"].includes(matchStatus)) {
      where.matchStatus = matchStatus;
    }

    if (reason && VALID_REASONS.includes(reason)) {
      where.reason = reason;
    }

    if (deviceIdParam) {
      const devId = parseInt(deviceIdParam, 10);
      if (!isNaN(devId)) where.deviceId = devId;
    }

    if (personIdParam) {
      const pId = parseInt(personIdParam, 10);
      if (!isNaN(pId)) where.personId = pId;
    }

    if (search) {
      where.OR = [
        { person: { firstName: { contains: search, mode: "insensitive" } } },
        { person: { lastName: { contains: search, mode: "insensitive" } } },
        { person: { personCode: { contains: search, mode: "insensitive" } } },
        { device: { deviceName: { contains: search, mode: "insensitive" } } },
        { device: { serialNumber: { contains: search, mode: "insensitive" } } },
      ];
    }

    const total = await prisma.accessLog.count({ where });
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const logs = await prisma.accessLog.findMany({
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
            department: true,
            faceImageUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Failed to retrieve access logs:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to retrieve access logs." },
      { status: 500 }
    );
  }
}
