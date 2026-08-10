import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, FastAPIError } from "@/lib/ai/fastapi";
import { findTopFaceMatches } from "@/lib/ai/face-recognition";
import { evaluateAccess } from "@/lib/access/access-control";
import { authenticateDevice } from "@/lib/access/device-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Extract and validate multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (_) {
      return NextResponse.json(
        {
          success: false,
          access_status: "denied",
          reason: "system_error",
          door_action: "lock",
          message: "No face photo provided. Please submit a multipart form-data request containing an 'image' file.",
        },
        { status: 400 }
      );
    }

    const imageFile = formData.get("image") as File | null;
    const deviceIdInput = formData.get("deviceId") as string | null;
    const apiKeyInput = formData.get("apiKey") as string | null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json(
        {
          success: false,
          access_status: "denied",
          reason: "system_error",
          door_action: "lock",
          message: "No face photo provided. Please select or attach an image file.",
        },
        { status: 400 }
      );
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          access_status: "denied",
          reason: "system_error",
          door_action: "lock",
          message: "Uploaded image file exceeds the 10MB size limit.",
        },
        { status: 400 }
      );
    }

    // 2. Step 2: Authenticate Device (if device credentials supplied)
    const deviceAuth = await authenticateDevice(deviceIdInput, apiKeyInput);
    if (!deviceAuth.isValid) {
      const processingTimeMs = Date.now() - startTime;
      return NextResponse.json(
        {
          success: false,
          access_status: "denied",
          reason: "system_error",
          door_action: "lock",
          message: `Device authentication failed: ${deviceAuth.reason || "invalid credentials"}.`,
          processing_time_ms: processingTimeMs,
        },
        { status: 401 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 3. Step 3: Run Milestone 6 recognition service
    let aiResult;
    try {
      aiResult = await generateEmbedding(imageBuffer, imageFile.name || "access.jpg");
    } catch (aiErr: any) {
      const processingTimeMs = Date.now() - startTime;

      if (aiErr instanceof FastAPIError) {
        let code = aiErr.code as string;
        if (code === "FASTAPI_UNAVAILABLE") code = "AI_SERVICE_UNAVAILABLE";

        // Log system error access attempt
        await prisma.accessLog.create({
          data: {
            deviceId: deviceAuth.device?.id || null,
            matchStatus: "rejected",
            accessStatus: "denied",
            reason: "system_error",
            doorAction: "lock",
            processingTimeMs,
          },
        });

        // Create high-severity system error Alert
        await prisma.alert.create({
          data: {
            deviceId: deviceAuth.device?.id || null,
            alertType: "system_error",
            title: "AI Service Unavailable",
            message: "FastAPI AI microservice was unreachable during access attempt.",
            severity: "high",
          },
        });

        return NextResponse.json(
          {
            success: false,
            access_status: "denied",
            reason: "system_error",
            door_action: "lock",
            error: code,
            message: aiErr.message,
            processing_time_ms: processingTimeMs,
          },
          { status: aiErr.statusCode }
        );
      }

      throw aiErr;
    }

    // Perform vector search
    const recognition = await findTopFaceMatches(aiResult.embedding);

    // 4. Step 4: Evaluate Access Control Decision Rules
    const decision = evaluateAccess({
      matchStatus: recognition.matchStatus,
      person: recognition.person,
      similarity: recognition.face.similarity,
      distance: recognition.face.distance,
      qualityScore: recognition.face.qualityScore,
    });

    const processingTimeMs = Date.now() - startTime;

    // 5. Step 5 & 6: Persist AccessLog and Security Alert in PostgreSQL
    const matchedPersonId = recognition.person?.id || null;
    const matchedEmbeddingId = recognition.face?.embeddingId || null;

    // Create AccessLog record
    const accessLog = await prisma.accessLog.create({
      data: {
        deviceId: deviceAuth.device?.id || null,
        personId: matchedPersonId,
        embeddingId: matchedEmbeddingId,
        matchStatus: recognition.matchStatus as any,
        accessStatus: decision.accessStatus as any,
        reason: decision.reason as any,
        doorAction: decision.doorAction as any,
        confidenceScore: recognition.face.similarity,
        embeddingDistance: recognition.face.distance,
        processingTimeMs,
      },
    });

    // Create security Alert if attempt was denied
    if (decision.accessStatus === "denied") {
      if (recognition.matchStatus === "unknown") {
        await prisma.alert.create({
          data: {
            deviceId: deviceAuth.device?.id || null,
            personId: null,
            alertType: "unknown_face",
            title: "Unknown Face Detected",
            message: "An unrecognized face attempted access.",
            severity: "medium",
          },
        });
      } else if (recognition.matchStatus === "ambiguous") {
        await prisma.alert.create({
          data: {
            deviceId: deviceAuth.device?.id || null,
            personId: null,
            alertType: "unauthorized_access",
            title: "Ambiguous Face Recognition",
            message: "Face recognition produced competing candidates with insufficient confidence margin.",
            severity: "medium",
          },
        });
      } else if (recognition.person && recognition.person.status !== "active") {
        await prisma.alert.create({
          data: {
            deviceId: deviceAuth.device?.id || null,
            personId: recognition.person.id,
            alertType: "unauthorized_access",
            title: "Unauthorized Access Attempt",
            message: `${recognition.person.firstName} ${recognition.person.lastName} (${recognition.person.personCode}) attempted access while status is ${recognition.person.status}.`,
            severity: "high",
          },
        });
      }
    }

    // 7. Step 7: Return structured access response (NO raw 512 floats)
    return NextResponse.json({
      success: true,
      access_status: decision.accessStatus,
      reason: decision.reason,
      door_action: decision.doorAction,
      match_status: recognition.matchStatus,
      person: recognition.person
        ? {
            id: recognition.person.id,
            person_code: recognition.person.personCode,
            first_name: recognition.person.firstName,
            last_name: recognition.person.lastName,
            category: recognition.person.category,
            department: recognition.person.department,
          }
        : null,
      face: {
        embedding_id: recognition.face.embeddingId,
        similarity: recognition.face.similarity,
        distance: recognition.face.distance,
        quality_score: recognition.face.qualityScore ?? aiResult.qualityScore,
        model: recognition.face.model || aiResult.model,
      },
      device: deviceAuth.device
        ? {
            id: deviceAuth.device.id,
            serial_number: deviceAuth.device.serialNumber,
            device_name: deviceAuth.device.deviceName,
          }
        : null,
      candidates: recognition.candidates,
      processing_time_ms: processingTimeMs,
    });
  } catch (error: any) {
    console.error("Unexpected error in access decision route:", error);
    const processingTimeMs = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        access_status: "denied",
        reason: "system_error",
        door_action: "lock",
        message: "An unexpected error occurred during access decision evaluation.",
        processing_time_ms: processingTimeMs,
      },
      { status: 500 }
    );
  }
}
