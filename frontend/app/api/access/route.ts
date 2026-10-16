import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeImage, FastAPIError } from "@/lib/ai/fastapi";
import { findTopFaceMatches } from "@/lib/ai/face-recognition";
import { evaluateAccess } from "@/lib/access/access-control";
import { authenticateDevice, DeviceAuthResult } from "@/lib/access/device-auth";
import { getServerSession } from "@/lib/get-session";
import { AccessReason, AccessStatus, DoorAction, MatchStatus } from "@prisma/client";

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
    const deviceIdInput = (formData.get("deviceId") || req.headers.get("x-device-id")) as string | null;
    const apiKeyInput = (formData.get("apiKey") || req.headers.get("x-api-key")) as string | null;
    const timestampInput = (formData.get("timestamp") || req.headers.get("x-timestamp")) as string | null;
    const nonceInput = (formData.get("nonce") || req.headers.get("x-nonce")) as string | null;
    const signatureInput = (formData.get("signature") || req.headers.get("x-signature")) as string | null;

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

    // 2. Step 2: Authenticate caller (Admin session for simulation / Device credentials for hardware)
    let deviceAuth: DeviceAuthResult = { isValid: false };

    if (!deviceIdInput && !apiKeyInput) {
      const session = await getServerSession();
      if (!session || !session.user || (session.user.role !== "ADMIN" && session.user.role !== "admin")) {
        const processingTimeMs = Date.now() - startTime;
        return NextResponse.json(
          {
            success: false,
            access_status: "denied",
            reason: "system_error",
            door_action: "lock",
            message: "Authentication required. Admin authorization or valid device credentials required.",
            processing_time_ms: processingTimeMs,
          },
          { status: 401 }
        );
      }
      deviceAuth = { isValid: true, device: null };
    } else {
      deviceAuth = await authenticateDevice(deviceIdInput, apiKeyInput, {
        timestamp: timestampInput,
        nonce: nonceInput,
        signature: signatureInput,
      });
      if (!deviceAuth.isValid) {
        const processingTimeMs = Date.now() - startTime;
        const isReplay = deviceAuth.reason === "replay_detected" || deviceAuth.reason === "timestamp_expired";
        const reasonMsg = deviceAuth.reason === "timestamp_expired"
          ? "Request timestamp expired. Potential replay attack blocked."
          : deviceAuth.reason === "replay_detected"
          ? "Replay attack detected: unique nonce has already been consumed."
          : `Device authentication failed: ${deviceAuth.reason || "invalid credentials"}.`;

        if (isReplay && deviceAuth.device) {
          await prisma.alert.create({
            data: {
              deviceId: deviceAuth.device.id,
              alertType: "unauthorized_access",
              title: "Replay Attack Detected",
              message: `Device #${deviceAuth.device.id} (${deviceAuth.device.deviceName}) submitted an invalid or repeated access request (${deviceAuth.reason}). Request blocked.`,
              severity: "critical",
            },
          });
        }

        return NextResponse.json(
          {
            success: false,
            access_status: "denied",
            reason: "system_error",
            door_action: "lock",
            message: reasonMsg,
            processing_time_ms: processingTimeMs,
          },
          { status: 401 }
        );
      }
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 3. Step 3: Run Unified YOLO Person Detection & InsightFace Biometric Pipeline
    let aiResult;
    try {
      aiResult = await analyzeImage(imageBuffer, imageFile.name || "access.jpg");
    } catch (aiErr: unknown) {
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
            status: "recognition_error",
            person_detected: false,
            face_detected: false,
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

    const processingTimeMs = Date.now() - startTime;

    // Handle Non-Biometric Scenarios (No Person / Person with No Face / Low Quality Face)
    // IMPORTANT: Suppress database AccessLog and Alert creation for these ephemeral states!
    if (aiResult.status === "no_person") {
      return NextResponse.json({
        success: true,
        status: "no_person",
        person_detected: false,
        face_detected: false,
        access_status: "denied",
        reason: "no_person_detected",
        door_action: "no_action",
        match_status: null,
        message: aiResult.message || "No person detected in the camera frame.",
        person: null,
        face: null,
        person_bbox: null,
        face_bbox: null,
        image_width: aiResult.imageWidth,
        image_height: aiResult.imageHeight,
        persons: [],
        faces: [],
        device: deviceAuth.device
          ? {
              id: deviceAuth.device.id,
              serial_number: deviceAuth.device.serialNumber,
              device_name: deviceAuth.device.deviceName,
            }
          : null,
        processing_time_ms: processingTimeMs,
      });
    }

    if (aiResult.status === "person_no_face") {
      return NextResponse.json({
        success: true,
        status: "person_no_face",
        person_detected: true,
        face_detected: false,
        access_status: "denied",
        reason: "no_face_detected",
        door_action: "no_action",
        match_status: null,
        message: aiResult.message || "Person detected — no face visible in the frame.",
        person: null,
        face: null,
        person_bbox: aiResult.primaryPersonBbox || null,
        face_bbox: null,
        image_width: aiResult.imageWidth,
        image_height: aiResult.imageHeight,
        persons: aiResult.persons,
        faces: [],
        device: deviceAuth.device
          ? {
              id: deviceAuth.device.id,
              serial_number: deviceAuth.device.serialNumber,
              device_name: deviceAuth.device.deviceName,
            }
          : null,
        processing_time_ms: processingTimeMs,
      });
    }

    if (aiResult.status === "face_low_quality" || !aiResult.embedding) {
      return NextResponse.json({
        success: true,
        status: "face_low_quality",
        person_detected: true,
        face_detected: true,
        access_status: "denied",
        reason: "poor_quality_face",
        door_action: "no_action",
        match_status: null,
        message:
          aiResult.message ||
          "Face detected with low quality or obstruction. Please face the camera directly in good lighting.",
        person: null,
        face: {
          similarity: 0,
          distance: 1,
          quality_score: aiResult.qualityScore,
          model: aiResult.model,
        },
        person_bbox: aiResult.primaryPersonBbox || null,
        face_bbox: aiResult.primaryFaceBbox || null,
        image_width: aiResult.imageWidth,
        image_height: aiResult.imageHeight,
        persons: aiResult.persons,
        faces: aiResult.faces,
        device: deviceAuth.device
          ? {
              id: deviceAuth.device.id,
              serial_number: deviceAuth.device.serialNumber,
              device_name: deviceAuth.device.deviceName,
            }
          : null,
        processing_time_ms: processingTimeMs,
      });
    }

    // Step 4: Face Detected & Evaluated -> Perform pgvector similarity search
    const recognition = await findTopFaceMatches(aiResult.embedding, 2, aiResult.model || "buffalo_s");

    // Step 5: Evaluate Access Control Decision Rules
    const decision = evaluateAccess({
      status: recognition.matchStatus === "matched" ? "known_individual" : "unknown_individual",
      matchStatus: recognition.matchStatus,
      person: recognition.person,
      similarity: recognition.face.similarity,
      distance: recognition.face.distance,
      qualityScore: recognition.face.qualityScore,
    });

    const isDeactivated = Boolean(
      recognition.person &&
      (recognition.person.status || "active").toLowerCase() !== "active"
    );

    // Step 6: Persist AccessLog and Security Alert in PostgreSQL ONLY for evaluated biometric events
    const matchedPersonId = recognition.person?.id || null;
    const matchedEmbeddingId = recognition.face?.embeddingId || null;

    // Create AccessLog record
    await prisma.accessLog.create({
      data: {
        deviceId: deviceAuth.device?.id || null,
        personId: matchedPersonId,
        embeddingId: matchedEmbeddingId,
        matchStatus: recognition.matchStatus as MatchStatus,
        accessStatus: decision.accessStatus as AccessStatus,
        reason: decision.reason as AccessReason,
        doorAction: decision.doorAction as DoorAction,
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
      } else if (isDeactivated && recognition.person) {
        const personStatus = recognition.person.status || "inactive";
        await prisma.alert.create({
          data: {
            deviceId: deviceAuth.device?.id || null,
            personId: recognition.person.id,
            alertType: "unauthorized_access",
            title: "Access Denied - Deactivated User",
            message: `${recognition.person.firstName} ${recognition.person.lastName} (${recognition.person.personCode}) attempted access while deactivated (${personStatus}). User is not allowed to access the system.`,
            severity: "high",
          },
        });
      }
    }

    const finalStatus: "known_individual" | "unknown_individual" =
      recognition.matchStatus === "matched" ? "known_individual" : "unknown_individual";

    // Step 7: Return structured access response (including person and face bounding boxes)
    return NextResponse.json({
      success: true,
      status: finalStatus,
      person_detected: true,
      face_detected: true,
      access_status: decision.accessStatus,
      reason: decision.reason,
      door_action: decision.doorAction,
      match_status: recognition.matchStatus,
      message: isDeactivated
        ? "User is deactivated and not allowed to access the system."
        : undefined,
      person: recognition.person
        ? {
            id: recognition.person.id,
            person_code: recognition.person.personCode,
            first_name: recognition.person.firstName,
            last_name: recognition.person.lastName,
            category: recognition.person.category,
            department: recognition.person.department,
            status: recognition.person.status,
            face_image_url: recognition.person.faceImageUrl,
          }
        : null,
      face: {
        embedding_id: recognition.face.embeddingId,
        similarity: recognition.face.similarity,
        distance: recognition.face.distance,
        quality_score: recognition.face.qualityScore ?? aiResult.qualityScore,
        model: recognition.face.model || aiResult.model,
      },
      person_bbox: aiResult.primaryPersonBbox || null,
      face_bbox: aiResult.primaryFaceBbox || null,
      image_width: aiResult.imageWidth,
      image_height: aiResult.imageHeight,
      persons: aiResult.persons,
      faces: aiResult.faces,
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
  } catch (error: unknown) {
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
