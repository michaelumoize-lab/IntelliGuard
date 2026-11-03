import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import type { Prisma, AccessStatus, MatchStatus, AccessReason } from "@prisma/client";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

const VALID_REASONS = [
  "face_match",
  "face_no_match",
  "unauthorized",
  "no_person_detected",
  "no_face_detected",
  "poor_quality_face",
  "insufficient_confidence",
  "time_restriction",
  "manual_override",
  "system_error",
];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const role = (session.user.role || "").toUpperCase();
    if (role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Admin authorization required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawPage = parseInt(searchParams.get("page") || "1", 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
    const search = (searchParams.get("search") || "").trim();
    const status = (searchParams.get("status") || "").trim().toLowerCase();
    const matchStatus = (searchParams.get("matchStatus") || "").trim().toLowerCase();
    const reason = (searchParams.get("reason") || "").trim().toLowerCase();
    const deviceIdParam = searchParams.get("deviceId");
    const personIdParam = searchParams.get("personId");

    const where: Prisma.AccessLogWhereInput = {};

    if (status && ["granted", "denied"].includes(status)) {
      where.accessStatus = status as AccessStatus;
    }

    if (matchStatus && ["matched", "unknown", "ambiguous", "rejected"].includes(matchStatus)) {
      where.matchStatus = matchStatus as MatchStatus;
    }

    if (reason && VALID_REASONS.includes(reason)) {
      where.reason = reason as AccessReason;
    }

    if (deviceIdParam) {
      if (UUID_REGEX.test(deviceIdParam)) {
        where.deviceUuidId = deviceIdParam;
      } else {
        where.device = { deviceCode: deviceIdParam };
      }
    }

    if (personIdParam) {
      if (UUID_REGEX.test(personIdParam)) {
        where.personUuidId = personIdParam;
      } else {
        where.person = { personCode: personIdParam };
      }
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

    const logsRaw = await prisma.accessLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        device: {
          select: {
            uuidId: true,
            deviceCode: true,
            deviceName: true,
            serialNumber: true,
            location: true,
          },
        },
        person: {
          select: {
            uuidId: true,
            personCode: true,
            firstName: true,
            lastName: true,
            category: true,
            department: true,
            status: true,
            faceImageUrl: true,
          },
        },
      },
    });

    const logs = logsRaw.map((log) => ({
      ...log,
      id: log.uuidId,
      uuidId: log.uuidId,
      device: log.device
        ? {
            ...log.device,
            id: log.device.uuidId,
            uuidId: log.device.uuidId,
          }
        : null,
      person: log.person
        ? {
            ...log.person,
            id: log.person.uuidId,
            uuidId: log.person.uuidId,
          }
        : null,
    }));

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
  } catch (error: unknown) {
    console.error("Failed to retrieve access logs:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to retrieve access logs." },
      { status: 500 }
    );
  }
}
