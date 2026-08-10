import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, FastAPIError } from "@/lib/ai/fastapi";
import { checkForDuplicateFace } from "@/lib/ai/duplicate-check";
import { uploadFaceImage, deleteFaceImage } from "@/lib/ai/imagekit";

export const dynamic = "force-dynamic";

// Allowed PersonCategory enum values matching Prisma schema
const VALID_CATEGORIES = ["employee", "student", "visitor", "contractor"];

export async function POST(req: NextRequest) {
  let uploadedFileId: string | null = null;

  try {
    const formData = await req.formData();

    // 1. Extract and validate text fields
    const firstName = (formData.get("firstName") as string || "").trim();
    const lastName = (formData.get("lastName") as string || "").trim();
    const categoryInput = (formData.get("category") as string || "visitor").trim().toLowerCase();
    const department = (formData.get("department") as string || "").trim() || null;
    const phone = (formData.get("phone") as string || "").trim() || null;
    const email = (formData.get("email") as string || "").trim() || null;
    const notes = (formData.get("notes") as string || "").trim() || null;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "First name and last name are required." },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.includes(categoryInput)) {
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATION_ERROR",
          message: `Invalid category '${categoryInput}'. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 2. Extract and validate uploaded image file
    const imageFile = formData.get("image") as File | null;
    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "A valid face photo is required for registration." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Image file size must not exceed 10MB." },
        { status: 400 }
      );
    }

    // Convert file to Buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 3. Step A: Call FastAPI for face detection, quality check & 512D ArcFace embedding
    const aiResult = await generateEmbedding(imageBuffer, imageFile.name || "face.jpg");

    // 4. Step B: Check for duplicate face using native PostgreSQL + pgvector
    const duplicateResult = await checkForDuplicateFace(aiResult.embedding, 0.85);
    if (duplicateResult.isDuplicate && duplicateResult.matchingPerson) {
      const match = duplicateResult.matchingPerson;
      return NextResponse.json(
        {
          success: false,
          error: "DUPLICATE_FACE",
          message: `Duplicate face detected. This individual is already registered as ${match.firstName} ${match.lastName} (${match.personCode}) with ${Math.round(match.similarity * 100)}% similarity match.`,
          matchingPerson: match,
        },
        { status: 400 }
      );
    }

    // 5. Step C: Upload original face image to ImageKit cloud storage (/intelliguard/persons/)
    const ikResult = await uploadFaceImage(imageBuffer, imageFile.name || "face.jpg");
    uploadedFileId = ikResult.fileId; // Save for cleanup in case database creation fails

    // 6. Step D: Create Person and FaceEmbedding records in PostgreSQL
    const personCode = `PER-${Date.now().toString().slice(-6)}`;

    // Wrap database creation in a try-catch for transactional ImageKit cleanup
    try {
      const newPerson = await prisma.person.create({
        data: {
          personCode,
          firstName,
          lastName,
          email,
          phone,
          category: categoryInput as any,
          department,
          status: "active",
          faceImageUrl: ikResult.url,
          faceImageFileId: ikResult.fileId,
          notes,
        },
      });

      // Insert 512D vector embedding using raw pgvector SQL cast
      const vectorLiteral = `[${aiResult.embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO face_embeddings (
          person_id, embedding, embedding_model, image_path, quality_score, is_active, created_at, updated_at
        ) VALUES (
          $1, $2::vector, $3, $4, $5, true, NOW(), NOW()
        );
        `,
        newPerson.id,
        vectorLiteral,
        aiResult.model || "Buffalo_L",
        ikResult.url,
        aiResult.qualityScore
      );

      // Return success response WITHOUT exposing raw 512 float values
      return NextResponse.json(
        {
          success: true,
          message: "Person registered successfully",
          person: {
            id: newPerson.id,
            personCode: newPerson.personCode,
            firstName: newPerson.firstName,
            lastName: newPerson.lastName,
            email: newPerson.email,
            phone: newPerson.phone,
            category: newPerson.category,
            department: newPerson.department,
            status: newPerson.status,
            faceImageUrl: newPerson.faceImageUrl,
          },
          embedding: {
            qualityScore: aiResult.qualityScore,
            detectionConfidence: aiResult.detectionConfidence,
            model: aiResult.model,
          },
        },
        { status: 201 }
      );
    } catch (dbError: any) {
      console.error("Database creation failed after ImageKit upload. Initiating cleanup:", dbError);
      
      // Cleanup: Delete newly uploaded ImageKit asset so no orphaned images remain
      if (uploadedFileId) {
        await deleteFaceImage(uploadedFileId);
      }

      if (dbError.code === "P2002") {
        const target = dbError.meta?.target;
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
        {
          success: false,
          error: "DATABASE_ERROR",
          message: "Failed to persist person record to database.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    // Handle specific FastAPI errors
    if (error instanceof FastAPIError) {
      return NextResponse.json(
        {
          success: false,
          error: error.code,
          message: error.message,
        },
        { status: error.statusCode }
      );
    }

    console.error("Unexpected error in person registration route:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred during person registration.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = (searchParams.get("search") || "").trim();
    const status = (searchParams.get("status") || "").trim().toLowerCase();
    const category = (searchParams.get("category") || "").trim().toLowerCase();

    // Construct Prisma WHERE conditions
    const where: any = {};

    if (search) {
      where.OR = [
        { personCode: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && ["active", "inactive", "suspended"].includes(status)) {
      where.status = status;
    }

    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    // Count total matching records
    const total = await prisma.person.count({ where });
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    // Retrieve paginated persons with active face embedding metadata
    const persons = await prisma.person.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        personCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        category: true,
        department: true,
        status: true,
        faceImageUrl: true,
        createdAt: true,
        updatedAt: true,
        faceEmbeddings: {
          where: { isActive: true },
          take: 1,
          select: {
            id: true,
            embeddingModel: true,
            qualityScore: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    // Format persons response with explicit embeddingStatus
    const formattedPersons = persons.map((p) => {
      const activeEmbedding = p.faceEmbeddings[0] || null;
      let embeddingStatus: "active" | "inactive" | "none" = "none";
      if (activeEmbedding) {
        embeddingStatus = activeEmbedding.isActive ? "active" : "inactive";
      }

      return {
        id: p.id,
        personCode: p.personCode,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        category: p.category,
        department: p.department,
        status: p.status,
        faceImageUrl: p.faceImageUrl,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        embeddingStatus,
        embedding: activeEmbedding
          ? {
              id: activeEmbedding.id,
              model: activeEmbedding.embeddingModel,
              qualityScore: activeEmbedding.qualityScore,
              createdAt: activeEmbedding.createdAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      persons: formattedPersons,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Failed to list persons:", error);
    return NextResponse.json(
      { success: false, error: "DATABASE_ERROR", message: "Failed to retrieve persons list." },
      { status: 500 }
    );
  }
}
