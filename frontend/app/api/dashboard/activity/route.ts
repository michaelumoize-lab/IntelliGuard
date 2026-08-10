import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
    const limit = Math.min(50, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit));
    const status = (searchParams.get("status") || "").trim().toLowerCase();

    const where: any = {};
    if (status && ["granted", "denied"].includes(status)) {
      where.accessStatus = status;
    }

    const events = await prisma.accessLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
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
            id: true,
            personCode: true,
            firstName: true,
            lastName: true,
            category: true,
            faceImageUrl: true,
          },
        },
        device: {
          select: {
            id: true,
            deviceName: true,
            serialNumber: true,
            location: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error: any) {
    console.error("Failed to retrieve dashboard activity events:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to retrieve dashboard activity events." },
      { status: 500 }
    );
  }
}
