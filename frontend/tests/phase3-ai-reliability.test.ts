import assert from "node:assert";
import {
  fastAPIEmbeddingResponseSchema,
  fastAPIAnalysisResponseSchema,
  FastAPIError,
} from "../lib/ai/fastapi";
import { evaluateAccess } from "../lib/access/access-control";

console.log("==================================================");
console.log("  Phase 3: AI Recognition Reliability Unit Tests  ");
console.log("==================================================\n");

// ---------------------------------------------------------------------------
// Test 1: Zod Embedding Response Schema - Valid 512D Vector
// ---------------------------------------------------------------------------
console.log("[Test 1] Valid 512D Embedding Response Schema Validation...");
const validEmbedding = Array.from({ length: 512 }, (_, i) => Math.sin(i) * 0.05);
const validEmbeddingPayload = {
  success: true,
  face_detected: true,
  embedding: validEmbedding,
  embedding_size: 512,
  normalized: true,
  quality_score: 0.88,
  detection_confidence: 0.96,
  model: "buffalo_s",
  execution_time_ms: 125.4,
};

const parsedEmbedding = fastAPIEmbeddingResponseSchema.safeParse(validEmbeddingPayload);
assert.strictEqual(parsedEmbedding.success, true, "Valid 512D payload must pass schema validation");
assert.strictEqual(parsedEmbedding.data?.embedding.length, 512);
assert.strictEqual(parsedEmbedding.data?.quality_score, 0.88);
console.log("✅ PASSED: Valid 512D embedding response passed strict Zod validation.\n");

// ---------------------------------------------------------------------------
// Test 2: Zod Embedding Response Schema - Rejects Truncated Vectors (e.g. 128D)
// ---------------------------------------------------------------------------
console.log("[Test 2] Rejects Truncated Vector Dimensions (128D instead of 512D)...");
const invalidDimPayload = {
  ...validEmbeddingPayload,
  embedding: Array.from({ length: 128 }, () => 0.1),
};
const parsedInvalidDim = fastAPIEmbeddingResponseSchema.safeParse(invalidDimPayload);
assert.strictEqual(parsedInvalidDim.success, false, "Must reject vector with length != 512");
console.log("✅ PASSED: Correctly rejected truncated 128D embedding vector.\n");

// ---------------------------------------------------------------------------
// Test 3: Zod Embedding Response Schema - Rejects Non-Finite Floats (NaN / Infinity)
// ---------------------------------------------------------------------------
console.log("[Test 3] Rejects Non-Finite Floats (NaN / Infinity)...");
const nanVector = [...validEmbedding];
nanVector[42] = NaN;
const parsedNan = fastAPIEmbeddingResponseSchema.safeParse({
  ...validEmbeddingPayload,
  embedding: nanVector,
});
assert.strictEqual(parsedNan.success, false, "Must reject NaN in embedding vector");

const infVector = [...validEmbedding];
infVector[100] = Infinity;
const parsedInf = fastAPIEmbeddingResponseSchema.safeParse({
  ...validEmbeddingPayload,
  embedding: infVector,
});
assert.strictEqual(parsedInf.success, false, "Must reject Infinity in embedding vector");
console.log("✅ PASSED: Correctly rejected NaN and Infinity values in embedding vector.\n");

// ---------------------------------------------------------------------------
// Test 4: Zod Unified Analysis Response Schema - Valid Analysis with Faces
// ---------------------------------------------------------------------------
console.log("[Test 4] Valid Unified Analysis Response Parsing...");
const validAnalysisPayload = {
  success: true,
  status: "face_low_quality",
  person_detected: true,
  face_detected: true,
  person_count: 1,
  face_count: 1,
  persons: [{ bbox: [50, 50, 200, 400], confidence: 0.92, is_primary: true }],
  faces: [{ bbox: [80, 80, 160, 160], confidence: 0.42 }],
  primary_person_bbox: [50, 50, 200, 400],
  primary_face_bbox: [80, 80, 160, 160],
  embedding: null,
  quality_score: 0.38,
  detection_confidence: 0.42,
  model: "buffalo_s",
  image_width: 640,
  image_height: 480,
  message: "Face detected with low quality: Lighting is too dark. Please move to a brighter area.",
  execution_time_ms: 184.2,
};
const parsedAnalysis = fastAPIAnalysisResponseSchema.safeParse(validAnalysisPayload);
assert.strictEqual(parsedAnalysis.success, true, "Valid analysis payload must pass schema validation");
assert.strictEqual(parsedAnalysis.data?.status, "face_low_quality");
assert.strictEqual(parsedAnalysis.data?.face_detected, true);
assert.strictEqual(parsedAnalysis.data?.quality_score, 0.38);
console.log("✅ PASSED: Unified analysis response parsed and validated correctly.\n");

// ---------------------------------------------------------------------------
// Test 5: Zod Unified Analysis Response Schema - Rejects Invalid Status Enum
// ---------------------------------------------------------------------------
console.log("[Test 5] Rejects Unknown Status Enum...");
const invalidStatusPayload = {
  ...validAnalysisPayload,
  status: "arbitrary_unsupported_status",
};
const parsedInvalidStatus = fastAPIAnalysisResponseSchema.safeParse(invalidStatusPayload);
assert.strictEqual(parsedInvalidStatus.success, false, "Must reject arbitrary status not in enum");
console.log("✅ PASSED: Correctly rejected invalid status enum string.\n");

// ---------------------------------------------------------------------------
// Test 6: Decision Engine - Quality Degradation Non-Action Behavior
// ---------------------------------------------------------------------------
console.log("[Test 6] Decision Engine Evaluation: face_low_quality...");
const lowQualDecision = evaluateAccess({
  status: "face_low_quality",
  similarity: 0,
  distance: 1,
  qualityScore: 0.35,
});
assert.strictEqual(lowQualDecision.accessStatus, "denied");
assert.strictEqual(lowQualDecision.reason, "poor_quality_face");
assert.strictEqual(lowQualDecision.doorAction, "no_action", "Low quality face must not trigger lock/unlock actuation");
console.log("✅ PASSED: face_low_quality results in denied + poor_quality_face + no_action.\n");

// ---------------------------------------------------------------------------
// Test 7: Decision Engine - Recognition Error Fail-Closed with Lock
// ---------------------------------------------------------------------------
console.log("[Test 7] Decision Engine Evaluation: recognition_error (Fail-Closed)...");
const recErrDecision = evaluateAccess({
  status: "recognition_error",
  similarity: 0,
  distance: 1,
});
assert.strictEqual(recErrDecision.accessStatus, "denied");
assert.strictEqual(recErrDecision.reason, "system_error");
assert.strictEqual(recErrDecision.doorAction, "lock", "System/recognition errors must actuate lock");
console.log("✅ PASSED: recognition_error fails closed with denied + system_error + lock.\n");

// ---------------------------------------------------------------------------
// Test 8: Decision Engine - Inactive Individual Unauthorized with Lock
// ---------------------------------------------------------------------------
console.log("[Test 8] Decision Engine Evaluation: Deactivated Person (Unauthorized)...");
const inactiveDecision = evaluateAccess({
  status: "known_individual",
  matchStatus: "matched",
  person: {
    id: 101,
    personCode: "PER-INACTIVE",
    firstName: "John",
    lastName: "Doe",
    category: "employee",
    department: "Engineering",
    status: "inactive",
  },
  similarity: 0.89,
  distance: 0.11,
});
assert.strictEqual(inactiveDecision.accessStatus, "denied");
assert.strictEqual(inactiveDecision.reason, "unauthorized");
assert.strictEqual(inactiveDecision.doorAction, "lock");
console.log("✅ PASSED: Inactive person denied with unauthorized + lock.\n");

// ---------------------------------------------------------------------------
// Test 9: FastAPIError Mapping Verification
// ---------------------------------------------------------------------------
console.log("[Test 9] FastAPIError Codes and Status Mapping...");
const errPoorQuality = new FastAPIError("POOR_QUALITY", "Image is too dark.", 400);
assert.strictEqual(errPoorQuality.code, "POOR_QUALITY");
assert.strictEqual(errPoorQuality.statusCode, 400);

const errUnavailable = new FastAPIError("FASTAPI_UNAVAILABLE", "AI service unreachable.", 503);
assert.strictEqual(errUnavailable.code, "FASTAPI_UNAVAILABLE");
assert.strictEqual(errUnavailable.statusCode, 503);

const errService = new FastAPIError("AI_SERVICE_ERROR", "Zod validation failed.", 502);
assert.strictEqual(errService.code, "AI_SERVICE_ERROR");
assert.strictEqual(errService.statusCode, 502);
console.log("✅ PASSED: FastAPIError codes and status codes behave as expected.\n");

// ---------------------------------------------------------------------------
// Test 10: Zod Unified Analysis - Tailgating Detection Payload Validation
// ---------------------------------------------------------------------------
console.log("[Test 10] Valid Unified Analysis with Tailgating Payload...");
const tailgatingPayload = {
  success: true,
  status: "face_detected_processing",
  person_detected: true,
  face_detected: true,
  person_count: 2,
  face_count: 1,
  persons: [
    { bbox: [100, 50, 350, 550], confidence: 0.94, is_primary: true },
    { bbox: [300, 80, 500, 520], confidence: 0.87, is_primary: false },
  ],
  faces: [{ bbox: [150, 100, 250, 220], confidence: 0.95 }],
  primary_person_bbox: [100, 50, 350, 550],
  primary_face_bbox: [150, 100, 250, 220],
  embedding: validEmbedding,
  embedding_size: 512,
  quality_score: 0.91,
  detection_confidence: 0.95,
  tailgating_detected: true,
  tailgating: {
    detected: true,
    trailing_count: 1,
    confidence: 0.87,
    risk_level: "critical",
    message: "Tailgating alert: 1 trailing individual detected in threshold zone.",
    proximity_ratio: 0.28,
  },
  model: "buffalo_s",
  image_width: 640,
  image_height: 480,
  execution_time_ms: 145.2,
};
const parsedTailgating = fastAPIAnalysisResponseSchema.safeParse(tailgatingPayload);
assert.strictEqual(parsedTailgating.success, true, "Tailgating payload must pass schema validation");
assert.strictEqual(parsedTailgating.data?.tailgating_detected, true);
assert.strictEqual(parsedTailgating.data?.tailgating?.trailing_count, 1);
assert.strictEqual(parsedTailgating.data?.tailgating?.risk_level, "critical");
console.log("✅ PASSED: Tailgating analysis payload parsed and validated correctly.\n");

console.log("==================================================");
console.log("  All Phase 3 AI Reliability Tests Passed!       ");
console.log("==================================================");
