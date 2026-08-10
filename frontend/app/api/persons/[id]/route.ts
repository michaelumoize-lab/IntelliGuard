import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFaceImage } from "@/lib/ai/imagekit";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["employee", "student", "visitor", "contractor"];
const VALID_STATUSES = ["active", "inactive", "suspended"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const personId = parseInt(resolvedParams.id, 10);
    if (isNaN(personId)) {
      return NextResponse.json(
        { success: false, error: "INVALID_ID", message: "Invalid person ID." },
        { status: 400 }
      );
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: {
        faceEmbeddings: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            embeddingModel: true,
            imagePath: true,
            qualityScore: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!person) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Person not found." },
        { status: 404 }
      );
    }

    const activeEmbedding = person.faceEmbeddings.find((e) => e.isActive) || null;
    let embeddingStatus: "active" | "inactive" | "none" = "none";
    if (activeEmbedding) {
      embeddingStatus = "active";
    } else if (person.faceEmbeddings.length > 0) {
      embeddingStatus = "inactive";
    }

    return NextResponse.json({
      success: true,
      person: {
        id: person.id,
        personCode: person.personCode,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        phone: person.phone,
        category: person.category,
        department: person.department,
        status: person.status,
        faceImageUrl: person.faceImageUrl,
        notes: person.notes,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
        embeddingStatus,
        activeEmbedding,
        embeddingHistory: person.faceEmbeddings,
      },
    });
  } catch (error: any) {
    console.error("Failed to retrieve person:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to retrieve person record." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const personId = parseInt(resolvedParams.id, 10);
    if (isNaN(personId)) {
      return NextResponse.json(
        { success: false, error: "INVALID_ID", message: "Invalid person ID." },
        { status: 400 }
      );
    }

    const existingPerson = await prisma.person.findUnique({
      where: { id: personId },
    });

    if (!existingPerson) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Person not found." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.firstName !== undefined) updateData.firstName = String(body.firstName).trim();
    if (body.lastName !== undefined) updateData.lastName = String(body.lastName).trim();
    if (body.email !== undefined) updateData.email = body.email ? String(body.email).trim() : null;
    if (body.phone !== undefined) updateData.phone = body.phone ? String(body.phone).trim() : null;
    if (body.department !== undefined) updateData.department = body.department ? String(body.department).trim() : null;
    if (body.notes !== undefined) updateData.notes = body.notes ? String(body.notes).trim() : null;

    if (body.category !== undefined) {
      const cat = String(body.category).trim().toLowerCase();
      if (!VALID_CATEGORIES.includes(cat)) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Invalid category '${cat}'.` },
          { status: 400 }
        );
      }
      updateData.category = cat;
    }

    if (body.status !== undefined) {
      const stat = String(body.status).trim().toLowerCase();
      if (!VALID_STATUSES.includes(stat)) {
        return NextResponse.json(
          { success: false, error: "VALIDATION_ERROR", message: `Invalid status '${stat}'.` },
          { status: 400 }
        );
      }
      updateData.status = stat;
    }

    const updatedPerson = await prisma.person.update({
      where: { id: personId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Person updated successfully",
      person: updatedPerson,
    });
  } catch (error: any) {
    console.error("Failed to update person:", error);

    if (error.code === "P2002") {
      const target = error.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(", ") : String(target || "");
      if (targetStr.includes("email")) {
        return NextResponse.json(
          { success: false, error: "DUPLICATE_EMAIL", message: "An individual with this email address is already registered." },
          { status: 400 }
        );
      }
      if (targetStr.includes("phone")) {
        return NextResponse.json(
          { success: false, error: "DUPLICATE_PHONE", message: "An individual with this phone number is already registered." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: "DUPLICATE_FIELD", message: `A record with this ${targetStr || "attribute"} already exists.` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to update person record." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const personId = parseInt(resolvedParams.id, 10);
    if (isNaN(personId)) {
      return NextResponse.json(
        { success: false, error: "INVALID_ID", message: "Invalid person ID." },
        { status: 400 }
      );
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, faceImageFileId: true },
    });

    if (!person) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Person not found." },
        { status: 404 }
      );
    }

    // 1. Delete ImageKit cloud asset if fileId exists (wrapped in try/catch so imagekit errors don't block deletion)
    if (person.faceImageFileId) {
      try {
        await deleteFaceImage(person.faceImageFileId);
      } catch (imgErr) {
        console.warn("Non-fatal ImageKit cleanup error during person deletion:", imgErr);
      }
    }

    // 2. Perform transactional deletion in PostgreSQL (nullify access logs/alerts, delete embeddings, delete person)
    await prisma.$transaction([
      prisma.accessLog.updateMany({
        where: { personId },
        data: { personId: null },
      }),
      prisma.alert.updateMany({
        where: { personId },
        data: { personId: null },
      }),
      prisma.faceEmbedding.deleteMany({
        where: { personId },
      }),
      prisma.person.delete({
        where: { id: personId },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Person and associated biometric data deleted successfully.",
    });
  } catch (error: any) {
    console.error("Failed to delete person:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: error.message || "Failed to delete person record." },
      { status: 500 }
    );
  }
}
