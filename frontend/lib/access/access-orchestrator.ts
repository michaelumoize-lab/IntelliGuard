import { NextRequest, NextResponse } from "next/server";
import { analyzeImage, FastAPIError } from "@/lib/ai/fastapi";
import { findTopFaceMatches } from "@/lib/ai/face-recognition";
import { evaluateAccess } from "@/lib/access/access-control";
import { authenticateDevice, DeviceAuthResult } from "@/lib/access/device-auth";
import { getServerSession } from "@/lib/get-session";
import { AccessReason, AccessStatus, DoorAction, MatchStatus } from "@prisma/client";
import { parseAccessRequest } from "@/lib/access/request-parser";
import { AuditLogger } from "@/lib/access/audit-logger";

/**
 * Access Orchestration Service
 * Coordinates request parsing, caller authentication, AI microservice inference,
 * vector similarity search, rule evaluation, and audit logging.
 */
export async function handleAccessRequest(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // 1. Extract and validate multipart form data and request headers
    const parseResult = await parseAccessRequest(req, startTime);
    if (!parseResult.ok) {
      return parseResult.errorResponse;
    }

    const { correlationId, imageFile, imageBuffer, bodyHash, isDeviceRequest, deviceInputs } =
      parseResult.data;

    // 2. Authenticate caller (Admin session for simulation / Device credentials for hardware)
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
      deviceAuth = await authenticateDevice(deviceInputs.deviceId, deviceInputs.apiKey, {
        timestamp: deviceInputs.timestamp,
        nonce: deviceInputs.nonce,
        signature: deviceInputs.signature,
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

        if (deviceAuth.device) {
          await AuditLogger.logDeviceAuthAlert(deviceAuth.device, deviceAuth.reason, isReplayOrTamper);
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

    // 3. Run Unified YOLO Person Detection & InsightFace Biometric Pipeline
    let aiResult;
    try {
      aiResult = await analyzeImage(imageBuffer, imageFile.name || "access.jpg", correlationId);
    } catch (aiErr: unknown) {
      const processingTimeMs = Date.now() - startTime;

      if (aiErr instanceof FastAPIError) {
        let code = aiErr.code as string;
        if (code === "FASTAPI_UNAVAILABLE") code = "AI_SERVICE_UNAVAILABLE";

        await AuditLogger.logSystemError(
          deviceAuth.device?.id || null,
          processingTimeMs,
          "AI Service Unavailable",
          "FastAPI AI microservice encountered an error or was unreachable during access attempt.",
          "high"
        );

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
    // Suppress database AccessLog and Alert creation for these ephemeral states
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
      await AuditLogger.logRecognitionError(deviceAuth.device?.id || null, processingTimeMs);

      return NextResponse.json({
        success: false,
        status: "recognition_error",
        person_detected: Boolean(aiResult.personDetected),
        face_detected: Boolean(aiResult.faceDetected),
        access_status: "denied",
        reason: "system_error",
        door_action: "lock",
        match_status: "rejected",
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
        liveness: aiResult.liveness || null,
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

    // Handle Anti-Spoofing / Presentation Attack Detection Results
    if (aiResult.status === "spoof_detected") {
      await AuditLogger.logSpoofAttempt(
        deviceAuth.device?.id || null,
        aiResult.liveness?.liveScore,
        aiResult.liveness?.model,
        processingTimeMs
      );

      return NextResponse.json(
        {
          success: true,
          status: "spoof_detected",
          person_detected: true,
          face_detected: true,
          access_status: "denied",
          reason: "spoof_detected",
          door_action: "lock",
          match_status: "rejected",
          message:
            aiResult.message ||
            "Presentation attack detected (fake/spoof face). Access denied.",
          person: null,
          face: {
            similarity: 0,
            distance: 1,
            quality_score: aiResult.qualityScore,
            model: aiResult.model,
          },
          liveness: aiResult.liveness || null,
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
        },
        { status: 200 }
      );
    }

    if (aiResult.status === "liveness_inconclusive") {
      await AuditLogger.logLivenessInconclusive(
        deviceAuth.device?.id || null,
        aiResult.liveness?.liveScore,
        processingTimeMs
      );

      return NextResponse.json({
        success: true,
        status: "liveness_inconclusive",
        person_detected: true,
        face_detected: true,
        access_status: "denied",
        reason: "insufficient_confidence",
        door_action: "no_action",
        match_status: null,
        message:
          aiResult.message ||
          "Liveness verification was inconclusive. Please face the camera directly in clear lighting and try again.",
        person: null,
        face: {
          similarity: 0,
          distance: 1,
          quality_score: aiResult.qualityScore,
          model: aiResult.model,
        },
        liveness: aiResult.liveness || null,
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
      await AuditLogger.logRecognitionError(deviceAuth.device?.id || null, processingTimeMs);

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
          error: "INVALID_AI_RESPONSE",
          message: "Processing failed: AI service returned an incomplete or malformed facial embedding.",
          processing_time_ms: processingTimeMs,
        },
        { status: 502 }
      );
    }

    // 4. Perform pgvector similarity search
    let recognition;
    try {
      recognition = await findTopFaceMatches(aiResult.embedding!, 2, aiResult.model || "buffalo_s");
    } catch (dbErr: unknown) {
      console.error("Database / pgvector similarity search failed:", dbErr);
      const errTimeMs = Date.now() - startTime;

      await AuditLogger.logSystemError(
        deviceAuth.device?.id || null,
        errTimeMs,
        "Database Vector Search Failure",
        "Database or pgvector similarity search failed during biometric verification.",
        "high"
      );

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
          error: "DATABASE_ERROR",
          message: "Verification error: database or vector similarity search failed.",
          processing_time_ms: errTimeMs,
        },
        { status: 500 }
      );
    }

    // 5. Evaluate Access Control Decision Rules
    const isTailgating = Boolean(aiResult.tailgatingDetected);

    const rawDecision = evaluateAccess({
      status:
        recognition.matchStatus === "matched"
          ? "known_individual"
          : recognition.matchStatus === "ambiguous"
          ? "ambiguous_match"
          : "unknown_individual",
      matchStatus: recognition.matchStatus,
      person: recognition.person,
      similarity: recognition.face.similarity,
      distance: recognition.face.distance,
      qualityScore: recognition.face.qualityScore,
      tailgatingDetected: isTailgating,
      trailingCount: aiResult.tailgating?.trailingCount || 0,
    });

    const personStatus = recognition.person
      ? (recognition.person.status || "active").toLowerCase()
      : "active";
    const isDeactivated = Boolean(recognition.person && personStatus !== "active");

    // Fail-safe guard: never grant access or unlock unless matched to an active person AND no tailgating
    const safeAccessGranted =
      rawDecision.accessStatus === "granted" &&
      recognition.matchStatus === "matched" &&
      Boolean(recognition.person) &&
      !isDeactivated &&
      !isTailgating;

    const decisionReason = isTailgating
      ? "unauthorized"
      : isDeactivated && recognition.matchStatus === "matched"
      ? "unauthorized"
      : rawDecision.reason;

    const decision = {
      accessStatus: (safeAccessGranted ? "granted" : "denied") as "granted" | "denied",
      reason: decisionReason as AccessReason,
      doorAction: (safeAccessGranted && rawDecision.doorAction === "unlock"
        ? "unlock"
        : rawDecision.doorAction === "no_action"
        ? "no_action"
        : "lock") as "unlock" | "lock" | "no_action",
    };

    // 6. Persist AccessLog and Security Alert in PostgreSQL ONLY for evaluated biometric events
    const matchedPersonId = recognition.person?.id || null;
    const matchedEmbeddingId = recognition.face?.embeddingId || null;

    await AuditLogger.logBiometricDecision({
      deviceId: deviceAuth.device?.id || null,
      personId: matchedPersonId,
      embeddingId: matchedEmbeddingId,
      matchStatus: recognition.matchStatus as MatchStatus,
      accessStatus: decision.accessStatus as AccessStatus,
      reason: decision.reason,
      doorAction: decision.doorAction as DoorAction,
      confidenceScore: recognition.face.similarity,
      embeddingDistance: recognition.face.distance,
      processingTimeMs,
    });

    if (decision.accessStatus === "denied") {
      await AuditLogger.logBiometricDeniedAlert({
        deviceId: deviceAuth.device?.id || null,
        person: recognition.person,
        matchStatus: recognition.matchStatus,
        isTailgating,
        trailingCount: aiResult.tailgating?.trailingCount || 0,
        isDeactivated,
        personStatus,
      });
    }

    const finalStatus: "known_individual" | "unknown_individual" | "ambiguous_match" =
      recognition.matchStatus === "matched"
        ? "known_individual"
        : recognition.matchStatus === "ambiguous"
        ? "ambiguous_match"
        : "unknown_individual";

    // 7. Return structured access response (including person and face bounding boxes)
    return NextResponse.json(
      {
        success: true,
        status: finalStatus,
        person_detected: true,
        face_detected: true,
        access_status: decision.accessStatus,
        reason: decision.reason,
        door_action: decision.doorAction,
        match_status: recognition.matchStatus,
        tailgating_detected: isTailgating,
        tailgating: aiResult.tailgating || null,
        message: isTailgating
          ? `Tailgating detected: ${aiResult.tailgating?.trailingCount || 1} unauthorized trailing person(s) in portal zone. Access denied.`
          : isDeactivated
          ? personStatus === "suspended"
            ? "User account is suspended and not allowed to access the system."
            : "User is deactivated and not allowed to access the system."
          : recognition.matchStatus === "ambiguous"
          ? "Ambiguous facial match across multiple registered individuals. Access denied."
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
        liveness: aiResult.liveness || null,
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
        correlation_id: correlationId,
      },
      {
        headers: { "X-Correlation-ID": correlationId },
      }
    );
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
