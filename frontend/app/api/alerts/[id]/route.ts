import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const alertId = parseInt(resolvedParams.id, 10);
    if (isNaN(alertId)) {
      return NextResponse.json(
        { success: false, error: "INVALID_ID", message: "Invalid alert ID." },
        { status: 400 }
      );
    }

    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Alert not found." },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const resolvedValue = body.resolved !== undefined ? Boolean(body.resolved) : true;

    const updatedAlert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        resolved: resolvedValue,
        resolvedAt: resolvedValue ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: resolvedValue ? "Alert resolved successfully." : "Alert status updated.",
      alert: updatedAlert,
    });
  } catch (error: any) {
    console.error("Failed to update alert:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to update alert status." },
      { status: 500 }
    );
  }
}
