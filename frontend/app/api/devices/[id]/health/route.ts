import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";

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

  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        status: true,
        lastSeen: true,
      },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Device not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deviceId: device.id,
      status: device.status,
      hardwareConnected: false,
      hardwareTelemetryAvailable: false,
      lastSeen: device.lastSeen,
      message: "Physical hardware telemetry is not currently available. Status represents administrative configuration state.",
    });
  } catch (error: any) {
    console.error("Error in GET /api/devices/[id]/health:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to fetch device health." },
      { status: 500 }
    );
  }
}
