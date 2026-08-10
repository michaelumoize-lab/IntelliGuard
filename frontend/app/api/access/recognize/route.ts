import { NextRequest, NextResponse } from "next/server";
import { generateEmbedding, FastAPIError } from "@/lib/ai/fastapi";
import { findTopFaceMatches } from "@/lib/ai/face-recognition";
import { getServerSession } from "@/lib/get-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate admin session
    const session = await getServerSession();
    if (!session || !session.user || (session.user.role !== "ADMIN" && session.user.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Admin authorization required." },
        { status: 401 }
      );
    }
    // 1. Extract and validate uploaded recognition image
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (_) {
      return NextResponse.json(
        { success: false, error: "IMAGE_REQUIRED", message: "No face photo provided. Please submit a multipart form-data request containing an 'image' file." },
        { status: 400 }
      );
    }

    const imageFile = formData.get("image") as File | null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json(
        { success: false, error: "IMAGE_REQUIRED", message: "No face photo provided. Please select or attach an image file for recognition." },
        { status: 400 }
      );
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "IMAGE_TOO_LARGE", message: "Uploaded image file exceeds the 10MB size limit. Please upload a smaller photo." },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 2. Call FastAPI AI microservice for 512D ArcFace vector extraction
    let aiResult;
    try {
      aiResult = await generateEmbedding(imageBuffer, imageFile.name || "recognition.jpg");
    } catch (aiErr: any) {
      if (aiErr instanceof FastAPIError) {
        let code = aiErr.code as string;
        if (code === "FASTAPI_UNAVAILABLE") code = "AI_SERVICE_UNAVAILABLE";
        return NextResponse.json(
          {
            success: false,
            error: code,
            message: aiErr.message,
          },
          { status: aiErr.statusCode }
        );
      }
      throw aiErr;
    }

    // 3. Perform PostgreSQL pgvector similarity search & threshold classification
    const recognition = await findTopFaceMatches(aiResult.embedding);
    const processingTimeMs = Date.now() - startTime;

    // 4. Return structured recognition response (omitting raw 512D floats)
    if (recognition.matchStatus === "matched" && recognition.person) {
      return NextResponse.json({
        success: true,
        match_status: "matched",
        person: {
          id: recognition.person.id,
          person_code: recognition.person.personCode,
          first_name: recognition.person.firstName,
          last_name: recognition.person.lastName,
          category: recognition.person.category,
          department: recognition.person.department,
        },
        face: {
          embedding_id: recognition.face.embeddingId,
          similarity: recognition.face.similarity,
          distance: recognition.face.distance,
          quality_score: recognition.face.qualityScore ?? aiResult.qualityScore,
          model: recognition.face.model || aiResult.model,
        },
        processing_time_ms: processingTimeMs,
      });
    }

    if (recognition.matchStatus === "ambiguous") {
      return NextResponse.json({
        success: true,
        match_status: "ambiguous",
        person: null,
        face: {
          similarity: recognition.face.similarity,
          distance: recognition.face.distance,
          quality_score: recognition.face.qualityScore ?? aiResult.qualityScore,
          model: recognition.face.model || aiResult.model,
        },
        candidates: recognition.candidates,
        processing_time_ms: processingTimeMs,
      });
    }

    // Unknown face classification
    return NextResponse.json({
      success: true,
      match_status: "unknown",
      person: null,
      face: {
        similarity: recognition.face.similarity,
        distance: recognition.face.distance,
        quality_score: recognition.face.qualityScore ?? aiResult.qualityScore,
        model: recognition.face.model || aiResult.model,
      },
      processing_time_ms: processingTimeMs,
    });
  } catch (error: any) {
    console.error("Unexpected error during face recognition:", error);
    return NextResponse.json(
      {
        success: false,
        error: "DATABASE_ERROR",
        message: "An unexpected error occurred during similarity search.",
      },
      { status: 500 }
    );
  }
}
