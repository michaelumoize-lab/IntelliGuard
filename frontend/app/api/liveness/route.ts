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

    // 2. Extract uploaded image
    const formData = await req.formData();
    const imageFile = (formData.get("file") || formData.get("image")) as File | null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json(
        { success: false, error: "INVALID_IMAGE", message: "Please upload a valid image file." },
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
