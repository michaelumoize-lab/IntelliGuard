import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { detectFaces, generateEmbedding, FastAPIError } from "@/lib/ai/fastapi";
import {
  checkForDuplicateFace,
  REQUIRED_DUPLICATE_MESSAGE,
} from "@/lib/ai/duplicate-check";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Admin authorization required." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const rawImage = formData.get("image");
    const rawExcludePersonId = formData.get("excludePersonId");

    let excludePersonId: number | undefined = undefined;
    if (rawExcludePersonId !== null && rawExcludePersonId !== undefined && String(rawExcludePersonId).trim() !== "") {
      const parsedId = parseInt(String(rawExcludePersonId), 10);
      if (isNaN(parsedId)) {
        return NextResponse.json(
          { success: false, canProceed: false, error: "VALIDATION_ERROR", message: "Invalid excludePersonId parameter." },
          { status: 400 }
        );
      }
      excludePersonId = parsedId;
    }

    if (!rawImage || !(rawImage instanceof File) || rawImage.size === 0) {
      return NextResponse.json(
        { success: false, canProceed: false, error: "VALIDATION_ERROR", message: "No image file provided." },
        { status: 400 }
      );
    }

    if (!rawImage.type || !rawImage.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, canProceed: false, error: "VALIDATION_ERROR", message: "Provided file is not a valid image format." },
        { status: 400 }
      );
    }

    const imageFile = rawImage;

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, canProceed: false, error: "VALIDATION_ERROR", message: "Image exceeds 10MB limit." },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const filename = imageFile.name || "face.jpg";

    const result = await detectFaces(imageBuffer, filename);

    const primaryFace = result.faces[0];
    const confidence = primaryFace ? Math.round(primaryFace.confidence * 100) : 0;
    const hasLandmarks = !!(primaryFace?.landmarks && primaryFace.landmarks.length > 0);

    if (result.faceCount === 0) {
      return NextResponse.json({
        success: true,
        canProceed: false,
        isDuplicate: false,
        status: "no_face_detected",
        error: "NO_FACE_DETECTED",
        faceCount: 0,
        confidence: 0,
        qualityStatus: "error",
        message: "No human face detected. Ensure good lighting and face camera directly.",
        hasLandmarks: false,
        faces: [],
        executionTimeMs: result.executionTimeMs,
      });
    }

    if (result.faceCount > 1) {
      return NextResponse.json({
        success: true,
        canProceed: false,
        isDuplicate: false,
        status: "multiple_faces",
        error: "MULTIPLE_FACES",
        faceCount: result.faceCount,
        confidence,
        qualityStatus: "error",
        message: `Multiple faces (${result.faceCount}) detected. Exactly 1 face is required for registration.`,
        hasLandmarks,
        faces: result.faces,
        executionTimeMs: result.executionTimeMs,
      });
    }

    // Generate 512D embedding & validate quality via FastAPI /api/v1/embedding
    let aiResult;
    try {
      aiResult = await generateEmbedding(imageBuffer, filename);
    } catch (err: unknown) {
      if (err instanceof FastAPIError) {
        if (err.code === "FASTAPI_UNAVAILABLE" || err.code === "AI_SERVICE_ERROR") {
          return NextResponse.json(
            {
              success: false,
              canProceed: false,
              isDuplicate: false,
              status: "ai_unavailable",
              error: err.code,
              qualityStatus: "error",
              message: "Biometric AI service is unavailable. Registration cannot proceed until prechecks succeed.",
            },
            { status: err.statusCode || 503 }
          );
        }
        return NextResponse.json({
          success: true,
          canProceed: false,
          isDuplicate: false,
          status: err.code.toLowerCase(),
          error: err.code,
          faceCount: result.faceCount,
          confidence,
          qualityStatus: "error",
          message: err.message,
          hasLandmarks,
          faces: result.faces,
          executionTimeMs: result.executionTimeMs,
        });
      }
      throw err;
    }

    // Compare against existing registered facial embeddings in PostgreSQL via pgvector
    const dupCheck = await checkForDuplicateFace(
      aiResult.embedding,
      undefined,
      excludePersonId,
      aiResult.model || "buffalo_s"
    );

    if (dupCheck.isDuplicate && dupCheck.matchingPerson) {
      const isDeactivated = dupCheck.matchingPerson.status !== "active";
      return NextResponse.json(
        {
          success: false,
          canProceed: false,
          isDuplicate: true,
          status: "duplicate_face",
          error: isDeactivated ? "DUPLICATE_FACE_DEACTIVATED" : "DUPLICATE_FACE",
          qualityStatus: "duplicate",
          message: REQUIRED_DUPLICATE_MESSAGE,
          faceCount: result.faceCount,
          confidence,
          qualityScore: aiResult.qualityScore,
          hasLandmarks,
          faces: result.faces,
          matchingPerson: {
            personCode: dupCheck.matchingPerson.personCode,
            firstName: dupCheck.matchingPerson.firstName,
            lastName: dupCheck.matchingPerson.lastName,
            status: dupCheck.matchingPerson.status,
            similarity: dupCheck.matchingPerson.similarity,
          },
          executionTimeMs: result.executionTimeMs + aiResult.executionTimeMs,
        },
        { status: 409 }
      );
    }

    let qualityStatus: "optimal" | "acceptable" | "warning" = "optimal";
    let message = "";

    if (primaryFace.confidence < 0.60) {
      qualityStatus = "warning";
      message = `Low face detection confidence (${confidence}%). Portrait may be blurry or obstructed.`;
    } else if (primaryFace.confidence < 0.80) {
      qualityStatus = "acceptable";
      message = `Moderate face detection confidence (${confidence}%). Verified unique biometric profile.`;
    } else {
      qualityStatus = "optimal";
      message = `High face detection confidence (${confidence}%). Verified unique biometric profile.`;
    }

    return NextResponse.json({
      success: true,
      canProceed: true,
      isDuplicate: false,
      status: "passed",
      faceCount: result.faceCount,
      confidence,
      qualityScore: aiResult.qualityScore,
      qualityStatus,
      message,
      hasLandmarks,
      faces: result.faces,
      executionTimeMs: result.executionTimeMs + aiResult.executionTimeMs,
    });
  } catch (err: unknown) {
    console.error("Face precheck error:", err);
    if (err instanceof FastAPIError && (err.code === "FASTAPI_UNAVAILABLE" || err.code === "AI_SERVICE_ERROR")) {
      return NextResponse.json(
        {
          success: false,
          canProceed: false,
          isDuplicate: false,
          qualityStatus: "error",
          error: err.code,
          message: "Biometric AI service is unavailable. Registration cannot proceed until prechecks succeed.",
        },
        { status: err.statusCode || 503 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        canProceed: false,
        isDuplicate: false,
        qualityStatus: "error",
        error: "PRECHECK_FAILED",
        message: "Unable to complete biometric duplicate verification. Registration cannot proceed right now.",
      },
      { status: 500 }
    );
  }
}
