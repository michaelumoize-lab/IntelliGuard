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
    | "no_person_detected"
    | "no_face_detected"
    | "poor_quality_face"
    | "insufficient_confidence"
    | "time_restriction"
    | "manual_override"
    | "system_error"
    | "tailgating_detected";
  door_action: "unlock" | "lock" | "no_action";
  match_status?: "matched" | "unknown" | "ambiguous" | "rejected" | null;
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
  liveness?: {
    status: "live" | "spoof_detected" | "inconclusive" | "error";
    model: string;
    live_score?: number;
    liveScore?: number;
    threshold?: number | null;
    individual_scores?: Record<string, number>;
    individualScores?: Record<string, number>;
    processing_time_ms?: number;
    processingTimeMs?: number;
    ensemble_method?: string;
    ensembleMethod?: string;
  } | null;
  person_bbox?: number[] | null;
  face_bbox?: number[] | null;
  image_width?: number;
  image_height?: number;
  tailgating_detected?: boolean;
  tailgating?: {
    detected: boolean;
    trailing_count?: number;
    trailingCount?: number;
    confidence: number;
    risk_level?: string;
    riskLevel?: string;
    message?: string | null;
    proximity_ratio?: number | null;
  } | null;
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

  // 1. If server returned an Anti-Spoofing or Liveness outcome, preserve it explicitly
  if (
    data &&
    (data.status === "spoof_detected" ||
      data.status === "liveness_inconclusive" ||
      data.reason === "spoof_detected")
  ) {
    return {
      success: true,
      status: data.status,
      person_detected: Boolean(data.person_detected),
      face_detected: Boolean(data.face_detected),
      access_status: "denied",
      reason: data.reason || "spoof_detected",
      door_action: data.door_action || "lock",
      match_status: data.match_status ?? "rejected",
      person: null,
      face: data.face ?? undefined,
      liveness: data.liveness ?? null,
      person_bbox: data.person_bbox ?? null,
      face_bbox: data.face_bbox ?? null,
      image_width: data.image_width,
      image_height: data.image_height,
      persons: data.persons ?? [],
      faces: data.faces ?? [],
      device: data.device ?? null,
      processing_time_ms: typeof data.processing_time_ms === "number" ? data.processing_time_ms : 0,
      message: data.message || "Presentation attack detected. Access denied.",
      error: data.error,
    };
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
      reason: data.reason || "system_error",
      door_action: "lock",
      match_status: "rejected",
      person: null,
      face: data.face ?? undefined,
      liveness: data.liveness ?? null,
      person_bbox: data.person_bbox ?? null,
      face_bbox: data.face_bbox ?? null,
      image_width: data.image_width,
      image_height: data.image_height,
      persons: data.persons ?? [],
      faces: data.faces ?? [],
      device: data.device ?? null,
      processing_time_ms: typeof data.processing_time_ms === "number" ? data.processing_time_ms : 0,
      message: data.message || "Failed to process face scan request.",
      error: data.error || (response.ok ? "BIOMETRIC_REJECTED" : `HTTP_${response.status}`),
    };
  }

  return data as AccessScanResponse;
}
