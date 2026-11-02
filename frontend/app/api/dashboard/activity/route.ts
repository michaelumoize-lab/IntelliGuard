import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import type { Prisma, AccessStatus } from "@prisma/client";

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
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
    const limit = Math.min(50, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit));
    const status = (searchParams.get("status") || "").trim().toLowerCase();

    const where: Prisma.AccessLogWhereInput = {};
    if (status && ["granted", "denied"].includes(status)) {
      where.accessStatus = status as AccessStatus;
    }

    const events = await prisma.accessLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        uuidId: true,
        accessCode: true,
        matchStatus: true,
        accessStatus: true,
        reason: true,
        doorAction: true,
        confidenceScore: true,
        embeddingDistance: true,
        processingTimeMs: true,
        createdAt: true,
        person: {
          select: {
            uuidId: true,
            personCode: true,
            firstName: true,
            lastName: true,
            category: true,
            faceImageUrl: true,
          },
        },
        device: {
          select: {
            uuidId: true,
            deviceCode: true,
            deviceName: true,
            serialNumber: true,
            location: true,
          },
        },
      },
    });

    const mappedEvents = events.map((event) => ({
      ...event,
      id: event.uuidId,
      uuidId: event.uuidId,
      person: event.person
        ? {
            ...event.person,
            id: event.person.uuidId,
            uuidId: event.person.uuidId,
          }
        : null,
      device: event.device
        ? {
            ...event.device,
            id: event.device.uuidId,
            uuidId: event.device.uuidId,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      events: mappedEvents,
    });
  } catch (error: unknown) {
    console.error("Failed to retrieve dashboard activity events:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to retrieve dashboard activity events." },
      { status: 500 }
    );
  }
}
