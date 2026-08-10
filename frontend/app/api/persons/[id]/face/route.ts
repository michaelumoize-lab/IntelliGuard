import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, FastAPIError } from "@/lib/ai/fastapi";
import { checkForDuplicateFace } from "@/lib/ai/duplicate-check";
import { uploadFaceImage, deleteFaceImage } from "@/lib/ai/imagekit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let newUploadedFileId: string | null = null;

  try {
    const resolvedParams = await params;
    const personId = parseInt(resolvedParams.id, 10);
    if (isNaN(personId)) {
      return NextResponse.json(
        { success: false, error: "INVALID_ID", message: "Invalid person ID." },
        { status: 400 }
      );
    }

    // 1. Verify person exists
    const person = await prisma.person.findUnique({
      where: { id: personId },
    });

    if (!person) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Person not found." },
        { status: 404 }
      );
    }

    const oldFileId = person.faceImageFileId;

    // 2. Extract and validate uploaded image file
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "A valid face photo is required." },
        { status: 400 }
      );
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Image file size must not exceed 10MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 3. Step A: Call FastAPI for face detection & 512D ArcFace embedding
    const aiResult = await generateEmbedding(imageBuffer, imageFile.name || "face.jpg");

    // 4. Step B: Check for duplicate face using pgvector (excluding this personId)
    const duplicateResult = await checkForDuplicateFace(aiResult.embedding, 0.85, personId);
    if (duplicateResult.isDuplicate && duplicateResult.matchingPerson) {
      const match = duplicateResult.matchingPerson;
      return NextResponse.json(
        {
          success: false,
          error: "DUPLICATE_FACE",
          message: `Duplicate face detected. This image matches registered person ${match.firstName} ${match.lastName} (${match.personCode}) with ${Math.round(match.similarity * 100)}% similarity match.`,
          matchingPerson: match,
        },
        { status: 400 }
      );
    }

    // 5. Step C: Upload NEW face image to ImageKit
    const ikResult = await uploadFaceImage(imageBuffer, imageFile.name || "face.jpg");
    newUploadedFileId = ikResult.fileId;

    // 6. Step D: Run Database Transaction
    try {
      const updatedPerson = await prisma.$transaction(async (tx) => {
        // Deactivate all previous embeddings for this person
        await tx.faceEmbedding.updateMany({
          where: { personId, isActive: true },
          data: { isActive: false },
        });

        // Insert new active 512D FaceEmbedding
        const vectorLiteral = `[${aiResult.embedding.join(",")}]`;
        await tx.$executeRawUnsafe(
          `
          INSERT INTO face_embeddings (
            person_id, embedding, embedding_model, image_path, quality_score, is_active, created_at, updated_at
          ) VALUES (
            $1, $2::vector, $3, $4, $5, true, NOW(), NOW()
          );
          `,
          personId,
          vectorLiteral,
          aiResult.model || "Buffalo_L",
          ikResult.url,
          aiResult.qualityScore
        );

        // Update Person record with new face image URL and file ID
        return await tx.person.update({
          where: { id: personId },
          data: {
            faceImageUrl: ikResult.url,
            faceImageFileId: ikResult.fileId,
          },
        });
      });

      // Step E: DB Transaction Succeeded -> Attempt deletion of OLD ImageKit asset
      if (oldFileId) {
        deleteFaceImage(oldFileId).catch((err) => {
          console.warn(`Failed to delete old ImageKit asset (${oldFileId}) after successful replacement:`, err);
        });
      }

      return NextResponse.json({
        success: true,
        message: "Face photo replaced successfully",
        person: {
          id: updatedPerson.id,
          personCode: updatedPerson.personCode,
          firstName: updatedPerson.firstName,
          lastName: updatedPerson.lastName,
          faceImageUrl: updatedPerson.faceImageUrl,
        },
        embedding: {
          qualityScore: aiResult.qualityScore,
          detectionConfidence: aiResult.detectionConfidence,
          model: aiResult.model,
          isActive: true,
        },
      });
    } catch (dbError: any) {
      console.error("Database transaction failed during face replacement. Initiating rollback cleanup:", dbError);

      // Rollback: Delete newly uploaded ImageKit asset so previous image/embedding remains active
      if (newUploadedFileId) {
        try {
          await deleteFaceImage(newUploadedFileId);
        } catch (cleanupErr) {
          console.error("Rollback image cleanup failed:", cleanupErr);
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: "DATABASE_ERROR",
          message: "Failed to update face image record in database.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
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

    console.error("Unexpected error in face replacement route:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred during face replacement.",
      },
      { status: 500 }
    );
  }
}
