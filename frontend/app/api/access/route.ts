import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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
          status: "recognition_error",
          person_detected: false,
          face_detected: false,
          access_status: "denied",
          reason: "system_error",
          door_action: "lock",
          match_status: "rejected",
          person: null,
          face: null,
          error: "INVALID_REQUEST",
          message: "No face photo provided. Please submit a multipart form-data request containing an 'image' file.",
          processing_time_ms: Date.now() - startTime,
        },
        { status: 400 }
      );
    }

    const imageFile = formData.get("image") as File | null;
    const rawDeviceIdForm = formData.get("deviceId");
    const rawApiKeyForm = formData.get("apiKey");
    const rawTimestampForm = formData.get("timestamp");
    const rawNonceForm = formData.get("nonce");
    const rawSignatureForm = formData.get("signature");

    const hasDeviceFormFields =
      formData.has("deviceId") ||
      formData.has("apiKey") ||
      formData.has("timestamp") ||
      formData.has("nonce") ||
      formData.has("signature");
    const hasDeviceHeaders =
      req.headers.has("x-device-id") ||
      req.headers.has("x-api-key") ||
      req.headers.has("x-device-serial") ||
      req.headers.has("x-device-api-key") ||
      req.headers.has("x-timestamp") ||
      req.headers.has("x-nonce") ||
      req.headers.has("x-signature");
    const isDeviceRequest = hasDeviceFormFields || hasDeviceHeaders;

    const deviceIdInput = (
      (typeof rawDeviceIdForm === "string" ? rawDeviceIdForm : null) ??
      req.headers.get("x-device-id") ??
      req.headers.get("x-device-serial")
    )?.trim() || null;
    const apiKeyInput = (
      (typeof rawApiKeyForm === "string" ? rawApiKeyForm : null) ??
      req.headers.get("x-api-key") ??
      req.headers.get("x-device-api-key")
    )?.trim() || null;
    const timestampInput = (
      (typeof rawTimestampForm === "string" ? rawTimestampForm : null) ??
      req.headers.get("x-timestamp")
    )?.trim() || null;
    const nonceInput = (
      (typeof rawNonceForm === "string" ? rawNonceForm : null) ??
      req.headers.get("x-nonce")
    )?.trim() || null;
    const signatureInput = (
      (typeof rawSignatureForm === "string" ? rawSignatureForm : null) ??
      req.headers.get("x-signature")
    )?.trim() || null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json(
        {
          success: false,
          status: "recognition_error",
          person_detected: false,
          face_detected: false,
          access_status: "denied",
          reason: "system_error",
          door_action: "lock",
          match_status: "rejected",
          person: null,
          face: null,
          error: "INVALID_IMAGE",
          message: "No face photo provided. Please select or attach an image file.",
          processing_time_ms: Date.now() - startTime,
        },
        { status: 400 }
      );
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          status: "recognition_error",
          person_detected: false,
          face_detected: false,
          access_status: "denied",
          reason: "system_error",
          door_action: "lock",
          match_status: "rejected",
          person: null,
          face: null,
          error: "IMAGE_TOO_LARGE",
          message: "Uploaded image file exceeds the 10MB size limit.",
          processing_time_ms: Date.now() - startTime,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const bodyHash = crypto.createHash("sha256").update(imageBuffer).digest("hex");

    // 2. Step 2: Authenticate caller (Admin session for simulation / Device credentials for hardware)
    // Never fall back to browser-session authentication if any device header or form field is present.
    let deviceAuth: DeviceAuthResult = { isValid: false };

    if (!isDeviceRequest) {
      const session = await getServerSession();
      if (!session || !session.user) {
        const processingTimeMs = Date.now() - startTime;
        return NextResponse.json(
          {
            success: false,
            status: "recognition_error",
            person_detected: false,
            face_detected: false,
            access_status: "denied",
            reason: "system_error",
            door_action: "lock",
            match_status: "rejected",
            person: null,
            face: null,
            error: "UNAUTHORIZED",
            message: "Authentication required. Admin authorization or valid device credentials required.",
            processing_time_ms: processingTimeMs,
          },
          { status: 401 }
        );
      }
      if (session.user.role !== "ADMIN" && session.user.role !== "admin") {
        const processingTimeMs = Date.now() - startTime;
        return NextResponse.json(
          {
            success: false,
            status: "recognition_error",
            person_detected: false,
            face_detected: false,
            access_status: "denied",
            reason: "system_error",
            door_action: "lock",
            match_status: "rejected",
            person: null,
            face: null,
            error: "FORBIDDEN",
            message: "Admin authorization required.",
            processing_time_ms: processingTimeMs,
          },
          { status: 403 }
        );
      }
      deviceAuth = { isValid: true, device: null };
    } else {
      deviceAuth = await authenticateDevice(deviceIdInput, apiKeyInput, {
        timestamp: timestampInput,
        nonce: nonceInput,
        signature: signatureInput,
        bodyHash,
      });
      if (!deviceAuth.isValid) {
        const processingTimeMs = Date.now() - startTime;
        const isReplayOrTamper =
          deviceAuth.reason === "replay_detected" ||
          deviceAuth.reason === "timestamp_expired" ||
          deviceAuth.reason === "invalid_signature";
        const isStatusBlocked =
          deviceAuth.reason === "device_in_maintenance" ||
          deviceAuth.reason === "device_error";
        const reasonMsg =
          deviceAuth.reason === "timestamp_expired"
            ? "Request timestamp expired. Potential replay attack blocked."
            : deviceAuth.reason === "replay_detected"
            ? "Replay attack detected: unique nonce has already been consumed."
            : deviceAuth.reason === "invalid_signature"
            ? "HMAC signature verification failed. Request payload was altered or unauthenticated."
            : `Device authentication failed: ${deviceAuth.reason || "invalid_credentials"}.`;

        try {
          if (isReplayOrTamper) {
            await prisma.alert.create({
              data: {
                deviceId: deviceAuth.device?.id ?? null,
                alertType: "unauthorized_access",
                title: deviceAuth.reason === "invalid_signature" ? "HMAC Tamper Attempt" : "Replay Attack Detected",
                message: deviceAuth.device
                  ? `Device #${deviceAuth.device.id} (${deviceAuth.device.deviceName}) submitted an invalid access request (${deviceAuth.reason}). Request blocked.`
                  : `An unverified device request failed replay/signature validation (${deviceAuth.reason}). Request blocked.`,
                severity: "critical",
              },
            });
          } else {
            await prisma.alert.create({
              data: {
                deviceId: deviceAuth.device?.id ?? null,
                alertType: "unauthorized_access",
                title: "Device Authentication Rejected",
                message: deviceAuth.device
                  ? `Device #${deviceAuth.device.id} (${deviceAuth.device.deviceName}) failed authentication (${deviceAuth.reason || "invalid_credentials"}). Request blocked.`
                  : `Rejected unauthenticated or malformed device access request (${deviceAuth.reason || "invalid_credentials"}).`,
                severity: "high",
              },
            });
          }
        } catch (alertErr: unknown) {
          console.error("Failed to record device authentication alert:", alertErr);
        }

        return NextResponse.json(
          {
            success: false,
            status: "recognition_error",
            person_detected: false,
            face_detected: false,
            access_status: "denied",
            reason: "system_error",
            door_action: "lock",
            match_status: "rejected",
            person: null,
            face: null,
            error: isStatusBlocked ? "DEVICE_FORBIDDEN" : "DEVICE_UNAUTHORIZED",
            message: reasonMsg,
            processing_time_ms: processingTimeMs,
          },
          { status: isStatusBlocked ? 403 : 401 }
        );
      }
    }

    // 3. Step 3: Run Unified YOLO Person Detection & InsightFace Biometric Pipeline
    let aiResult;
    try {
      aiResult = await analyzeImage(imageBuffer, imageFile.name || "access.jpg");
    } catch (aiErr: unknown) {
      const processingTimeMs = Date.now() - startTime;

      if (aiErr instanceof FastAPIError) {
        let code = aiErr.code as string;
        if (code === "FASTAPI_UNAVAILABLE") code = "AI_SERVICE_UNAVAILABLE";

        try {
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

          await prisma.alert.create({
            data: {
              deviceId: deviceAuth.device?.id || null,
              alertType: "system_error",
              title: "AI Service Unavailable",
              message: "FastAPI AI microservice encountered an error or was unreachable during access attempt.",
              severity: "high",
            },
          });
        } catch (logErr: unknown) {
          console.error("Failed to persist AI service error log/alert:", logErr);
        }

        return NextResponse.json(
          {
            success: false,
            status: "recognition_error",
            person_detected: false,
            face_detected: false,
            access_status: "denied",
            reason: "system_error",
            door_action: "lock",
            match_status: "rejected",
            person: null,
            face: null,
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

    if (aiResult.status === "recognition_error") {
      try {
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
      } catch (logErr: unknown) {
        console.error("Failed to record recognition_error AccessLog:", logErr);
      }

      return NextResponse.json({
        success: false,
        status: "recognition_error",
        person_detected: Boolean(aiResult.personDetected),
        face_detected: Boolean(aiResult.faceDetected),
        access_status: "denied",
        reason: "system_error",
        door_action: "lock",
        match_status: "rejected",
        liveness_status: null,
        liveness_score: null,
        liveness_time_ms: null,
        message: aiResult.message || "Biometric recognition error encountered. Please check camera feed or try again.",
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

    if (aiResult.status === "face_low_quality") {
      return NextResponse.json({
        success: true,
        status: "face_low_quality",
        person_detected: true,
        face_detected: true,
        access_status: "denied",
        reason: "poor_quality_face",
        door_action: "no_action",
        match_status: null,
        liveness_status: null,
        liveness_score: null,
        liveness_time_ms: null,
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

    const hasValidEmbedding =
      Array.isArray(aiResult.embedding) &&
      aiResult.embedding.length === 512 &&
      aiResult.embedding.every((val) => typeof val === "number" && Number.isFinite(val));

    if (!hasValidEmbedding) {
      try {
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
      } catch (logErr: unknown) {
        console.error("Failed to record invalid embedding AccessLog:", logErr);
      }

      return NextResponse.json(
        {
          success: false,
          status: "recognition_error",
          person_detected: Boolean(aiResult.personDetected),
          face_detected: Boolean(aiResult.faceDetected),
          access_status: "denied",
          reason: "system_error",
          door_action: "lock",
          match_status: "rejected",
          person: null,
          face: null,
          person_bbox: aiResult.primaryPersonBbox || null,
          face_bbox: aiResult.primaryFaceBbox || null,
          image_width: aiResult.imageWidth,
          image_height: aiResult.imageHeight,
          persons: aiResult.persons || [],
          faces: aiResult.faces || [],
          device: deviceAuth.device
            ? {
                id: deviceAuth.device.id,
                serial_number: deviceAuth.device.serialNumber,
                device_name: deviceAuth.device.deviceName,
              }
            : null,
          liveness_status: null,
          liveness_score: null,
          liveness_time_ms: null,
          error: "INVALID_AI_RESPONSE",
          message: "Processing failed: AI service returned an incomplete or malformed facial embedding.",
          processing_time_ms: processingTimeMs,
        },
        { status: 502 }
      );
    }

    // Step 4: Face Detected & Evaluated -> Perform pgvector similarity search
    let recognition;
    try {
      recognition = await findTopFaceMatches(aiResult.embedding!, 2, aiResult.model || "buffalo_s");
    } catch (dbErr: unknown) {
      console.error("Database / pgvector similarity search failed:", dbErr);
      const errTimeMs = Date.now() - startTime;

      try {
        await prisma.accessLog.create({
          data: {
            deviceId: deviceAuth.device?.id || null,
            matchStatus: "rejected",
            accessStatus: "denied",
            reason: "system_error",
            doorAction: "lock",
            processingTimeMs: errTimeMs,
          },
        });

        await prisma.alert.create({
          data: {
            deviceId: deviceAuth.device?.id || null,
            alertType: "system_error",
            title: "Database Vector Search Failure",
            message: "Database or pgvector similarity search failed during biometric verification.",
            severity: "high",
          },
        });
      } catch (_) {
        // Ignore secondary logging failure when database is unreachable
      }

      return NextResponse.json(
        {
          success: false,
          status: "recognition_error",
          person_detected: Boolean(aiResult.personDetected),
          face_detected: Boolean(aiResult.faceDetected),
          access_status: "denied",
          reason: "system_error",
          door_action: "lock",
          match_status: "rejected",
          person: null,
          face: null,
          person_bbox: aiResult.primaryPersonBbox || null,
          face_bbox: aiResult.primaryFaceBbox || null,
          image_width: aiResult.imageWidth,
          image_height: aiResult.imageHeight,
          persons: aiResult.persons || [],
          faces: aiResult.faces || [],
          device: deviceAuth.device
            ? {
                id: deviceAuth.device.id,
                serial_number: deviceAuth.device.serialNumber,
                device_name: deviceAuth.device.deviceName,
              }
            : null,
          liveness_status: null,
          liveness_score: null,
          liveness_time_ms: null,
          error: "DATABASE_ERROR",
          message: "Verification error: database or vector similarity search failed.",
          processing_time_ms: errTimeMs,
        },
        { status: 500 }
      );
    }

    // Step 5: Evaluate Access Control Decision Rules
    const rawDecision = evaluateAccess({
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

    // Fail-safe guard: never grant access or unlock unless matched to an active person
    const safeAccessGranted =
      rawDecision.accessStatus === "granted" &&
      recognition.matchStatus === "matched" &&
      Boolean(recognition.person) &&
      !isDeactivated;

    const decision = {
      accessStatus: (safeAccessGranted ? "granted" : "denied") as "granted" | "denied",
      reason: rawDecision.reason,
      doorAction: (safeAccessGranted && rawDecision.doorAction === "unlock"
        ? "unlock"
        : rawDecision.doorAction === "no_action"
        ? "no_action"
        : "lock") as "unlock" | "lock" | "no_action",
    };

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
      liveness_status: null,
      liveness_score: null,
      liveness_time_ms: null,
      processing_time_ms: processingTimeMs,
    });
  } catch (error: unknown) {
    console.error("Unexpected error in access decision route:", error);
    const processingTimeMs = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        status: "recognition_error",
        person_detected: false,
        face_detected: false,
        access_status: "denied",
        reason: "system_error",
        door_action: "lock",
        match_status: "rejected",
        person: null,
        face: null,
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected technical error occurred during access decision evaluation.",
        processing_time_ms: processingTimeMs,
      },
      { status: 500 }
    );
  }
}
