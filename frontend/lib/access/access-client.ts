export interface AccessScanResponse {
  success: boolean;
  access_status: "granted" | "denied";
  reason:
    | "face_match"
    | "face_no_match"
    | "insufficient_confidence"
    | "time_restriction"
    | "manual_override"
    | "system_error";
  door_action: "unlock" | "lock" | "no_action";
  match_status: "matched" | "unknown" | "ambiguous" | "rejected";
  person?: {
    id: number;
    person_code: string;
    first_name: string;
    last_name: string;
    category: string;
    department: string | null;
  } | null;
  face?: {
    embedding_id?: number;
    similarity: number;
    distance: number;
    quality_score?: number | null;
    model?: string;
  };
  device?: {
    id: number;
    serial_number: string;
    device_name: string;
  } | null;
  candidates?: Array<{
    personCode: string;
    firstName: string;
    lastName: string;
    similarity: number;
  }>;
  processing_time_ms: number;
  message?: string;
  error?: string;
}

/**
 * Submits captured webcam frame to the main access control pipeline (POST /api/access).
 * Omits deviceId for browser-based simulation requests.
 */
export async function scanFace(imageBlob: Blob): Promise<AccessScanResponse> {
  const formData = new FormData();
  formData.append("image", imageBlob, "webcam_frame.jpg");

  const response = await fetch("/api/access", {
    method: "POST",
    body: formData,
  });

  let data: any = {};
  try {
    data = await response.json();
  } catch (_) {
    // Non-JSON error body fallback
  }

  if (!response.ok && !data.access_status) {
    return {
      success: false,
      access_status: "denied",
      reason: "system_error",
      door_action: "lock",
      match_status: "rejected",
      person: null,
      processing_time_ms: 0,
      message: data.message || "Failed to process face scan request.",
      error: data.error || "SERVER_ERROR",
    };
  }

  return data as AccessScanResponse;
}
