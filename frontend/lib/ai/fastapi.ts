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
    model: data.model || "buffalo_l",
    executionTimeMs: data.execution_time_ms || 0.0,
  };
}
