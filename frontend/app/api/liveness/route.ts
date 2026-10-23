import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { checkLiveness, FastAPIError } from "@/lib/ai/fastapi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate admin user
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

    // Enforce 10 MB maximum upstream at request boundary before parsing multipart body
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "IMAGE_TOO_LARGE", message: "Uploaded request body exceeds 10MB limit." },
        { status: 413 }
      );
    }

    // 2. Extract uploaded image
    const formData = await req.formData();
    const imageFile = (formData.get("file") || formData.get("image")) as File | null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json(
        { success: false, error: "INVALID_IMAGE", message: "Please upload a valid image file." },
        { status: 400 }
      );
    }

    if (imageFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "IMAGE_TOO_LARGE", message: "Uploaded image file exceeds 10MB limit." },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Call FastAPI dedicated liveness endpoint
    const result = await checkLiveness(buffer, imageFile.name || "liveness.jpg");

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof FastAPIError) {
      return NextResponse.json(
        { success: false, error: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Liveness endpoint error:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Failed to evaluate liveness." },
      { status: 500 }
    );
  }
}
