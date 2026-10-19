import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth();
  if (authCheck.error) return authCheck.error;

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
    const resolvedByUserId =
      resolvedValue && typeof authCheck.session.user.id === "string" && authCheck.session.user.id.trim()
        ? authCheck.session.user.id
        : null;

    let updatedAlert;
    try {
      updatedAlert = await prisma.alert.update({
        where: { id: alertId },
        data: {
          resolved: resolvedValue,
          resolvedAt: resolvedValue ? new Date() : null,
          resolvedBy: resolvedByUserId,
        },
      });
    } catch (updateErr: unknown) {
      if (
        resolvedByUserId &&
        updateErr instanceof Prisma.PrismaClientKnownRequestError &&
        updateErr.code === "P2003"
      ) {
        updatedAlert = await prisma.alert.update({
          where: { id: alertId },
          data: {
            resolved: resolvedValue,
            resolvedAt: resolvedValue ? new Date() : null,
            resolvedBy: null,
          },
        });
      } else {
        throw updateErr;
      }
    }

    return NextResponse.json({
      success: true,
      message: resolvedValue ? "Alert resolved successfully." : "Alert status updated.",
      alert: updatedAlert,
    });
  } catch (error: unknown) {
    console.error("Failed to update alert:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to update alert status." },
      { status: 500 }
    );
  }
}
