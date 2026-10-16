import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { detectFaces } from "@/lib/ai/fastapi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user || (session.user.role !== "ADMIN" && session.user.role !== "admin")) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Admin authorization required." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const rawImage = formData.get("image");

    if (!rawImage || !(rawImage instanceof File) || rawImage.size === 0) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "No image file provided." },
        { status: 400 }
      );
    }

    if (!rawImage.type || !rawImage.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Provided file is not a valid image format." },
        { status: 400 }
      );
    }

    const imageFile = rawImage;

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: "Image exceeds 10MB limit." },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const result = await detectFaces(imageBuffer, imageFile.name || "face.jpg");

    let qualityStatus: "optimal" | "acceptable" | "warning" | "error" = "optimal";
    let message = "";
    const primaryFace = result.faces[0];
    const confidence = primaryFace ? Math.round(primaryFace.confidence * 100) : 0;
    const hasLandmarks = !!(primaryFace?.landmarks && primaryFace.landmarks.length > 0);

    if (result.faceCount === 0) {
      qualityStatus = "error";
      message = "No human face detected. Ensure good lighting and face camera directly.";
    } else if (result.faceCount > 1) {
      qualityStatus = "warning";
      message = `Multiple faces (${result.faceCount}) detected. Exactly 1 face is required for registration.`;
    } else if (primaryFace.confidence < 0.60) {
      qualityStatus = "warning";
      message = `Low face detection confidence (${confidence}%). Portrait may be blurry or obstructed.`;
    } else if (primaryFace.confidence < 0.80) {
      qualityStatus = "acceptable";
      message = `Moderate face detection confidence (${confidence}%).`;
    } else {
      qualityStatus = "optimal";
      message = `High face detection confidence (${confidence}%).`;
    }

    return NextResponse.json({
      success: true,
      faceCount: result.faceCount,
      confidence,
      qualityStatus,
      message,
      hasLandmarks,
      faces: result.faces,
      executionTimeMs: result.executionTimeMs,
    });
  } catch (err: unknown) {
    console.error("Face precheck error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "PRECHECK_FAILED",
        message: err instanceof Error ? err.message : "Failed to analyze photo quality.",
      },
      { status: 500 }
    );
  }
}
