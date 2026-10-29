import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export interface ParsedAccessRequest {
  correlationId: string;
  imageFile: File;
  imageBuffer: Buffer;
  bodyHash: string;
  isDeviceRequest: boolean;
  deviceInputs: {
    deviceId: string | null;
    apiKey: string | null;
    timestamp: string | null;
    nonce: string | null;
    signature: string | null;
  };
}

export type ParseResult =
  | { ok: true; data: ParsedAccessRequest }
  | { ok: false; errorResponse: NextResponse };

/**
 * Extracts, validates, and normalizes multipart form-data, payload hashes,
 * and device authentication headers for incoming /api/access requests.
 */
export async function parseAccessRequest(
  req: NextRequest,
  startTime: number
): Promise<ParseResult> {
  const correlationId =
    req.headers.get("x-correlation-id") ||
    req.headers.get("x-request-id") ||
    `ig_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (_) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
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
          message:
            "No face photo provided. Please submit a multipart form-data request containing an 'image' file.",
          processing_time_ms: Date.now() - startTime,
        },
        { status: 400 }
      ),
    };
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
    return {
      ok: false,
      errorResponse: NextResponse.json(
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
      ),
    };
  }

  if (imageFile.size > 10 * 1024 * 1024) {
    return {
      ok: false,
      errorResponse: NextResponse.json(
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
      ),
    };
  }

  const arrayBuffer = await imageFile.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);
  const bodyHash = crypto.createHash("sha256").update(imageBuffer).digest("hex");

  return {
    ok: true,
    data: {
      correlationId,
      imageFile,
      imageBuffer,
      bodyHash,
      isDeviceRequest,
      deviceInputs: {
        deviceId: deviceIdInput,
        apiKey: apiKeyInput,
        timestamp: timestampInput,
        nonce: nonceInput,
        signature: signatureInput,
      },
    },
  };
}
