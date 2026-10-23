import assert from "node:assert";
import {
  fastAPILivenessDetailSchema,
  fastAPIAnalysisResponseSchema,
  fastAPIEmbeddingResponseSchema,
} from "../lib/ai/fastapi";

console.log("==================================================");
console.log("  Presentation Attack Detection (PAD) Unit Tests  ");
console.log("==================================================\n");

// Test 1: Liveness Detail Schema Validation for Genuine Bona Fide Face
console.log("[Test 1] Validating bona fide LIVE schema parsing...");
const livePayload = {
  status: "live",
  model: "MiniFASNetV2+MiniFASNetV1SE",
  live_score: 0.985,
  threshold: 0.80,
  individual_scores: {
    MiniFASNetV2: 0.982,
    MiniFASNetV1SE: 0.988,
  },
  processing_time_ms: 24.5,
  ensemble_method: "mean",
};
const parsedLive = fastAPILivenessDetailSchema.safeParse(livePayload);
assert.strictEqual(parsedLive.success, true, "Valid LIVE payload must parse successfully");
assert.strictEqual(parsedLive.data?.status, "live");
assert.strictEqual(parsedLive.data?.live_score, 0.985);
console.log("✅ PASSED: Genuine LIVE response parsed correctly.\n");

// Test 2: Liveness Detail Schema Validation for Presentation Attack (Spoof)
console.log("[Test 2] Validating SPOOF_DETECTED schema parsing...");
const spoofPayload = {
  status: "spoof_detected",
  model: "MiniFASNetV2+MiniFASNetV1SE",
  live_score: 0.042,
  threshold: 0.80,
  individual_scores: {
    MiniFASNetV2: 0.035,
    MiniFASNetV1SE: 0.049,
  },
  processing_time_ms: 22.1,
  ensemble_method: "mean",
};
const parsedSpoof = fastAPILivenessDetailSchema.safeParse(spoofPayload);
assert.strictEqual(parsedSpoof.success, true, "Valid SPOOF payload must parse successfully");
assert.strictEqual(parsedSpoof.data?.status, "spoof_detected");
assert.strictEqual(parsedSpoof.data?.live_score, 0.042);
console.log("✅ PASSED: SPOOF_DETECTED response parsed correctly.\n");

// Test 3: Liveness Detail Schema Validation for INCONCLUSIVE status
console.log("[Test 3] Validating INCONCLUSIVE schema parsing...");
const inconclusivePayload = {
  status: "inconclusive",
  model: "MiniFASNetV2+MiniFASNetV1SE",
  live_score: 0.62,
  threshold: 0.80,
  individual_scores: {
    MiniFASNetV2: 0.70,
    MiniFASNetV1SE: 0.54,
  },
  processing_time_ms: 25.0,
  ensemble_method: "mean",
};
const parsedInconclusive = fastAPILivenessDetailSchema.safeParse(inconclusivePayload);
assert.strictEqual(parsedInconclusive.success, true);
assert.strictEqual(parsedInconclusive.data?.status, "inconclusive");
console.log("✅ PASSED: INCONCLUSIVE response parsed correctly.\n");

// Test 4: Rejects Invalid Liveness Status Enum
console.log("[Test 4] Rejecting unknown liveness status string...");
const invalidStatusPayload = {
  status: "totally_real_human",
  model: "MiniFASNetV2",
  live_score: 0.99,
  processing_time_ms: 10.0,
};
const parsedInvalid = fastAPILivenessDetailSchema.safeParse(invalidStatusPayload);
assert.strictEqual(parsedInvalid.success, false, "Must reject invalid status enum");
console.log("✅ PASSED: Invalid status enum correctly rejected.\n");

// Test 5: Unified Analysis Response with Spoof Detected & Null Embedding (Fail-Closed)
console.log("[Test 5] Validating fail-closed Unified Analysis schema on spoof attack...");
const spoofAnalysisPayload = {
  success: false,
  status: "spoof_detected",
  person_detected: true,
  face_detected: true,
  person_count: 1,
  face_count: 1,
  persons: [{ bbox: [100, 50, 450, 720], confidence: 0.92, is_primary: true }],
  faces: [{ bbox: [200, 100, 350, 250], confidence: 0.98 }],
  primary_person_bbox: [100, 50, 450, 720],
  primary_face_bbox: [200, 100, 350, 250],
  embedding: null, // Critical: embedding must be null to block downstream recognition
  embedding_size: null,
  quality_score: 0.88,
  detection_confidence: 0.98,
  liveness: spoofPayload,
  model: "buffalo_s",
  image_width: 640,
  image_height: 480,
  message: "Presentation attack detected. Access denied.",
  execution_time_ms: 45.2,
  yolo_time_ms: 12.0,
  insightface_time_ms: 10.5,
  antispoof_time_ms: 22.1,
};
const parsedSpoofAnalysis = fastAPIAnalysisResponseSchema.safeParse(spoofAnalysisPayload);
assert.strictEqual(parsedSpoofAnalysis.success, true, "Spoof analysis schema must parse cleanly");
assert.strictEqual(parsedSpoofAnalysis.data?.embedding, null, "Embedding must be null on spoof");
assert.strictEqual(parsedSpoofAnalysis.data?.status, "spoof_detected");
assert.strictEqual(parsedSpoofAnalysis.data?.liveness?.status, "spoof_detected");
console.log("✅ PASSED: Fail-closed analysis schema verified (embedding=null on spoof).\n");

// Test 6: Face Registration Embedding Schema includes Liveness
console.log("[Test 6] Validating FaceEmbeddingResponse schema with liveness detail...");
const validVector = Array.from({ length: 512 }, (_, i) => (i === 0 ? 1.0 : 0.0));
const embeddingWithLivenessPayload = {
  success: true,
  face_detected: true,
  embedding: validVector,
  embedding_size: 512,
  normalized: true,
  quality_score: 0.95,
  detection_confidence: 0.99,
  model: "buffalo_s",
  model_version: null,
  liveness: livePayload,
  execution_time_ms: 65.4,
};
const parsedEmbedding = fastAPIEmbeddingResponseSchema.safeParse(embeddingWithLivenessPayload);
assert.strictEqual(parsedEmbedding.success, true);
assert.strictEqual(parsedEmbedding.data?.liveness?.status, "live");
assert.strictEqual(parsedEmbedding.data?.embedding.length, 512);
console.log("✅ PASSED: FaceEmbeddingResponse cleanly validates liveness metadata.\n");

console.log("==================================================");
console.log("  All Presentation Attack Detection Tests Passed! ");
console.log("==================================================\n");
