export interface AccessScanResponse {
  success: boolean;
  status?:
    | "no_person"
    | "person_no_face"
    | "face_low_quality"
    | "spoof_detected"
    | "liveness_inconclusive"
    | "face_detected_processing"
    | "known_individual"
    | "unknown_individual"
    | "ambiguous_match"
    | "recognition_error";
  person_detected?: boolean;
  face_detected?: boolean;
  access_status: "granted" | "denied";
  reason:
    | "face_match"
    | "face_no_match"
    | "unauthorized"
    | "spoof_detected"
    | "liveness_failed"
    | "no_person_detected"
    | "no_face_detected"
    | "poor_quality_face"
    | "insufficient_confidence"
    | "time_restriction"
    | "manual_override"
    | "system_error";
  door_action: "unlock" | "lock" | "no_action";
  match_status?: "matched" | "unknown" | "ambiguous" | "rejected" | null;
  liveness_status?: "live" | "spoof" | "inconclusive" | null;
  liveness_score?: number | null;
  liveness_time_ms?: number | null;
  person?: {
    id: number;
    person_code: string;
    first_name: string;
    last_name: string;
    category: string;
    department: string | null;
    status?: string;
    face_image_url?: string | null;
  } | null;
  face?: {
    embedding_id?: number;
    similarity: number;
    distance: number;
    quality_score?: number | null;
    model?: string;
  };
  person_bbox?: number[] | null;
  face_bbox?: number[] | null;
  image_width?: number;
  image_height?: number;
  persons?: Array<{ bbox: number[]; confidence: number; is_primary: boolean }>;
  faces?: Array<{ bbox: number[]; confidence: number; landmarks?: number[][] }>;
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

  let response: Response;
  try {
    response = await fetch("/api/access", {
      method: "POST",
      body: formData,
    });
  } catch {
    return {
      success: false,
      status: "recognition_error",
      person_detected: false,
      face_detected: false,
      access_status: "denied",
      reason: "system_error",
      door_action: "lock",
      match_status: "rejected",
      person: null,
      processing_time_ms: 0,
      message: "Network or backend service unavailable. Please try again.",
      error: "NETWORK_ERROR",
    };
  }

  let data: Partial<AccessScanResponse> = {};
  try {
    data = (await response.json()) as Partial<AccessScanResponse>;
  } catch {
    // Non-JSON error body fallback
  }

  if (
    !response.ok ||
    data.success === false ||
    data.status === "recognition_error" ||
    data.reason === "system_error" ||
    data.match_status === "rejected"
  ) {
    return {
      success: false,
      status: "recognition_error",
      person_detected: Boolean(data.person_detected),
      face_detected: Boolean(data.face_detected),
      access_status: "denied",
      reason: "system_error",
      door_action: "lock",
      match_status: "rejected",
      person: null,
      face: data.face ?? undefined,
      person_bbox: data.person_bbox ?? null,
      face_bbox: data.face_bbox ?? null,
      image_width: data.image_width,
      image_height: data.image_height,
      persons: data.persons ?? [],
      faces: data.faces ?? [],
      device: data.device ?? null,
      liveness_status: data.liveness_status ?? null,
      liveness_score: data.liveness_score ?? null,
      liveness_time_ms: data.liveness_time_ms ?? null,
      processing_time_ms: typeof data.processing_time_ms === "number" ? data.processing_time_ms : 0,
      message: data.message || "Failed to process face scan request.",
      error: data.error || "SERVER_ERROR",
    };
  }

  return data as AccessScanResponse;
}
