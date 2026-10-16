import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import { Prisma, AccessStatus, AccessReason, MatchStatus } from "@prisma/client";

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
  const statusParam = (url.searchParams.get("status") || "").trim();
  const search = (url.searchParams.get("search") || "").trim();
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Device not found." },
        { status: 404 }
      );
    }

    const whereClause: Prisma.AccessLogWhereInput = { deviceId };

    if (statusParam) {
      if (!Object.values(AccessStatus).includes(statusParam as AccessStatus)) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Invalid access status: ${statusParam}` },
          { status: 400 }
        );
      }
      whereClause.accessStatus = statusParam as AccessStatus;
    }

    if (search) {
      const orConditions: Prisma.AccessLogWhereInput[] = [
        { person: { firstName: { contains: search, mode: "insensitive" } } },
        { person: { lastName: { contains: search, mode: "insensitive" } } },
        { person: { personCode: { contains: search, mode: "insensitive" } } },
      ];
      if (Object.values(AccessReason).includes(search as AccessReason)) {
        orConditions.push({ reason: search as AccessReason });
      }
      if (Object.values(MatchStatus).includes(search as MatchStatus)) {
        orConditions.push({ matchStatus: search as MatchStatus });
      }
      whereClause.OR = orConditions;
    }

    if (dateFrom || dateTo) {
      const createdAtFilter: { gte?: Date; lte?: Date } = {};
      if (dateFrom) {
        const parsedDateFrom = new Date(dateFrom);
        if (isNaN(parsedDateFrom.getTime())) {
          return NextResponse.json(
            { success: false, error: "VALIDATION_ERROR", message: "Invalid dateFrom parameter." },
            { status: 400 }
          );
        }
        createdAtFilter.gte = parsedDateFrom;
      }
      if (dateTo) {
        const parsedDateTo = new Date(dateTo);
        if (isNaN(parsedDateTo.getTime())) {
          return NextResponse.json(
            { success: false, error: "VALIDATION_ERROR", message: "Invalid dateTo parameter." },
            { status: 400 }
          );
        }
        createdAtFilter.lte = parsedDateTo;
      }
      whereClause.createdAt = createdAtFilter;
    }

    const total = await prisma.accessLog.count({ where: whereClause });
    const totalPages = Math.ceil(total / limit);

    const logsRaw = await prisma.accessLog.findMany({
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
            category: true,
            department: true,
            faceImageUrl: true,
          },
        },
      },
    });

    const data = logsRaw.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      person: log.person,
      matchStatus: log.matchStatus,
      accessStatus: log.accessStatus,
      reason: log.reason,
      doorAction: log.doorAction,
      confidenceScore: log.confidenceScore,
      embeddingDistance: log.embeddingDistance,
      processingTimeMs: log.processingTimeMs,
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
    console.error("Error in GET /api/devices/[id]/logs:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to fetch device access logs." },
      { status: 500 }
    );
  }
}
