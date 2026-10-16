import "dotenv/config";
export interface FastAPIEmbeddingResult {
  success: boolean;
  faceDetected: boolean;
  embedding: number[];
  embeddingSize: number;
  normalized: boolean;
  qualityScore: number;
  detectionConfidence: number;
  model: string;
  executionTimeMs: number;
}

export class FastAPIError extends Error {
  code: "FASTAPI_UNAVAILABLE" | "NO_FACE_DETECTED" | "MULTIPLE_FACES" | "POOR_QUALITY" | "INVALID_IMAGE" | "AI_SERVICE_ERROR";
  statusCode: number;

  constructor(
    code: "FASTAPI_UNAVAILABLE" | "NO_FACE_DETECTED" | "MULTIPLE_FACES" | "POOR_QUALITY" | "INVALID_IMAGE" | "AI_SERVICE_ERROR",
    message: string,
    statusCode: number = 400
  ) {
    super(message);
    this.name = "FastAPIError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Server-side client function to request 512D facial embedding generation from FastAPI AI microservice.
 */
export async function generateEmbedding(
  imageBuffer: Buffer,
  filename: string = "face.jpg"
): Promise<FastAPIEmbeddingResult> {
  const baseUrl = process.env.FASTAPI_URL || "http://localhost:8000";
  const minQualityThreshold = parseFloat(process.env.MIN_FACE_QUALITY || "0.70");

  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/v1/embedding`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
  formData.append("file", blob, filename);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for CPU inference

    response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err: unknown) {
    console.error("FastAPI service connection error:", err);
    throw new FastAPIError(
      "FASTAPI_UNAVAILABLE",
      "AI face processing service is currently unavailable or unreachable.",
      503
    );
  }

  if (response.status === 503) {
    throw new FastAPIError(
      "FASTAPI_UNAVAILABLE",
      "Face embedding service is starting up or in degraded state.",
      503
    );
  }

  if (!response.ok) {
    let errorDetail = "Failed to process face image.";
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch (_) {}

    if (errorDetail.includes("No face detected")) {
      throw new FastAPIError("NO_FACE_DETECTED", errorDetail, 400);
    } else if (errorDetail.includes("Multiple faces detected") || errorDetail.includes("one face is required")) {
      throw new FastAPIError("MULTIPLE_FACES", errorDetail, 400);
    } else if (response.status === 400) {
      throw new FastAPIError("INVALID_IMAGE", errorDetail, 400);
    } else {
      throw new FastAPIError("AI_SERVICE_ERROR", errorDetail, response.status);
    }
  }

  const data = await response.json();

  if (!data.embedding || !Array.isArray(data.embedding) || data.embedding.length !== 512) {
    throw new FastAPIError(
      "AI_SERVICE_ERROR",
      `Invalid embedding dimension returned: expected 512, received ${data.embedding?.length}`,
      500
    );
  }

  const qualityScore = typeof data.quality_score === "number" ? data.quality_score : 0.0;
  if (qualityScore < minQualityThreshold) {
    throw new FastAPIError(
      "POOR_QUALITY",
      `Face image quality score is too low (${qualityScore.toFixed(2)} < required minimum ${minQualityThreshold.toFixed(2)}). Please upload a clearer, well-lit photo.`,
      400
    );
  }

  return {
    success: true,
    faceDetected: true,
    embedding: data.embedding,
    embeddingSize: data.embedding_size || 512,
    normalized: data.normalized ?? true,
    qualityScore,
    detectionConfidence: data.detection_confidence || 0.0,
    model: data.model || "buffalo_s",
    executionTimeMs: data.execution_time_ms || 0.0,
  };
}

export interface DetectedFaceItem {
  bbox: number[];
  confidence: number;
  landmarks?: number[][];
}

export interface FaceDetectionResult {
  success: boolean;
  faceCount: number;
  faces: DetectedFaceItem[];
  executionTimeMs: number;
}

/**
 * Server-side client function to run face detection and landmark pre-check on an image.
 */
export async function detectFaces(
  imageBuffer: Buffer,
  filename: string = "face.jpg"
): Promise<FaceDetectionResult> {
  const baseUrl = process.env.FASTAPI_URL || "http://localhost:8000";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/v1/detect`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
  formData.append("file", blob, filename);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`AI Detection responded with status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return {
      success: !!data.success,
      faceCount: typeof data.face_count === "number" ? data.face_count : (data.faces || []).length,
      faces: (data.faces || []).map((f: { bbox?: number[]; confidence?: number; landmarks?: number[][] }) => ({
        bbox: f.bbox || [],
        confidence: typeof f.confidence === "number" ? f.confidence : 0,
        landmarks: f.landmarks || undefined,
      })),
      executionTimeMs: data.execution_time_ms || 0,
    };
  } catch (err: unknown) {
    console.error("FastAPI detectFaces error:", err);
    throw err;
  }
}

export interface DetectedPersonItem {
  bbox: number[];
  confidence: number;
  is_primary: boolean;
}

export interface FastAPIAnalysisResult {
  success: boolean;
  status:
    | "no_person"
    | "person_no_face"
    | "face_low_quality"
    | "spoof_detected"
    | "liveness_inconclusive"
    | "face_detected_processing"
    | "known_individual"
    | "unknown_individual"
    | "recognition_error";
  personDetected: boolean;
  faceDetected: boolean;
  personCount: number;
  faceCount: number;
  persons: DetectedPersonItem[];
  faces: DetectedFaceItem[];
  primaryPersonBbox?: number[] | null;
  primaryFaceBbox?: number[] | null;
  embedding?: number[] | null;
  embeddingSize?: number | null;
  qualityScore?: number | null;
  detectionConfidence?: number | null;
  livenessStatus?: "live" | "spoof" | "inconclusive" | null;
  livenessScore?: number | null;
  model?: string;
  imageWidth: number;
  imageHeight: number;
  message?: string;
  executionTimeMs: number;
  yoloTimeMs?: number;
  insightfaceTimeMs?: number;
  livenessTimeMs?: number;
}

/**
 * Server-side client function to request unified YOLO person detection,
 * InsightFace face detection, and embedding extraction from FastAPI.
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  filename: string = "frame.jpg"
): Promise<FastAPIAnalysisResult> {
  const baseUrl = process.env.FASTAPI_URL || "http://localhost:8000";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/v1/analyze`;

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
  formData.append("file", blob, filename);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err: unknown) {
    console.error("FastAPI analyzeImage connection error:", err);
    throw new FastAPIError(
      "FASTAPI_UNAVAILABLE",
      "AI computer vision service is currently unavailable or unreachable.",
      503
    );
  }

  if (response.status === 503) {
    throw new FastAPIError(
      "FASTAPI_UNAVAILABLE",
      "AI computer vision service is starting up or in degraded state.",
      503
    );
  }

  if (!response.ok) {
    let errorDetail = "Failed to analyze image.";
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Ignore JSON parse errors for non-JSON response bodies
    }
    throw new FastAPIError("AI_SERVICE_ERROR", errorDetail, response.status);
  }

  const data = await response.json();

  return {
    success: !!data.success,
    status: data.status,
    personDetected: !!data.person_detected,
    faceDetected: !!data.face_detected,
    personCount: typeof data.person_count === "number" ? data.person_count : 0,
    faceCount: typeof data.face_count === "number" ? data.face_count : 0,
    persons: (data.persons || []).map((p: { bbox?: number[]; confidence?: number; is_primary?: boolean }) => ({
      bbox: p.bbox || [],
      confidence: typeof p.confidence === "number" ? p.confidence : 0,
      is_primary: !!p.is_primary,
    })),
    faces: (data.faces || []).map((f: { bbox?: number[]; confidence?: number; landmarks?: number[][] }) => ({
      bbox: f.bbox || [],
      confidence: typeof f.confidence === "number" ? f.confidence : 0,
      landmarks: f.landmarks || undefined,
    })),
    primaryPersonBbox: data.primary_person_bbox || null,
    primaryFaceBbox: data.primary_face_bbox || null,
    embedding: Array.isArray(data.embedding) ? data.embedding : null,
    embeddingSize: data.embedding_size || (data.embedding ? data.embedding.length : null),
    qualityScore: typeof data.quality_score === "number" ? data.quality_score : null,
    detectionConfidence: typeof data.detection_confidence === "number" ? data.detection_confidence : null,
    livenessStatus: data.liveness_status || null,
    livenessScore: typeof data.liveness_score === "number" ? data.liveness_score : null,
    model: data.model || "buffalo_s",
    imageWidth: data.image_width || 640,
    imageHeight: data.image_height || 480,
    message: data.message || undefined,
    executionTimeMs: data.execution_time_ms || 0,
    yoloTimeMs: data.yolo_time_ms || 0,
    insightfaceTimeMs: data.insightface_time_ms || 0,
    livenessTimeMs: data.liveness_time_ms || 0,
  };
}

