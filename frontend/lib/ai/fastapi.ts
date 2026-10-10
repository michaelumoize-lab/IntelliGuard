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
  } catch (err: any) {
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
      faceCount: typeof data.face_count === "number" ? data.face_count : (data.faces?.length || 0),
      faces: (data.faces || []).map((f: any) => ({
        bbox: f.bbox || [],
        confidence: typeof f.confidence === "number" ? f.confidence : 0,
        landmarks: f.landmarks || undefined,
      })),
      executionTimeMs: data.execution_time_ms || 0,
    };
  } catch (err: any) {
    console.error("FastAPI detectFaces error:", err);
    throw new FastAPIError(
      "FASTAPI_UNAVAILABLE",
      err.message || "Failed to contact AI detection microservice.",
      503
    );
  }
}

