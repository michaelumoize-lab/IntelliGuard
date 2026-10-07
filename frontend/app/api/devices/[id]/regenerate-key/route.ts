import crypto from "crypto";
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

export async function POST(
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
    const existing = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Device not found." },
        { status: 404 }
      );
    }

    const rawApiKey = `ig_dev_${crypto.randomBytes(24).toString("hex")}`;
    const apiKeyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");

    await prisma.device.update({
      where: { id: deviceId },
      data: { apiKeyHash },
    });

    return NextResponse.json({
      success: true,
      message: "API key regenerated successfully. Previous API key has been invalidated.",
      apiKey: rawApiKey,
    });
  } catch (error: any) {
    console.error("Error in POST /api/devices/[id]/regenerate-key:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Failed to regenerate API key." },
      { status: 500 }
    );
  }
}
