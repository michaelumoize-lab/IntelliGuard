import fs from "fs";
import path from "path";
import { generateEmbedding, FastAPIError } from "./fastapi";

async function runTests() {
  console.log("=== Milestone 4 Verification Tests ===");

  const singleFacePath = path.join(__dirname, "../../../backend/tests/single_face.jpg");
  const testImgPath = path.join(__dirname, "../../../backend/test.jpg");

  if (!fs.existsSync(singleFacePath)) {
    console.error("Test image not found:", singleFacePath);
    process.exit(1);
  }

  // 1. Test FastAPI Embedding Client with single face
  console.log("\n[Test 1] Testing FastAPI client with single face image...");
  try {
    const singleBuf = fs.readFileSync(singleFacePath);
    const result = await generateEmbedding(singleBuf, "single_face.jpg");
    console.log("✅ FastAPI Embedding Success!");
    console.log(` - Vector size: ${result.embedding.length}`);
    console.log(` - Normalized: ${result.normalized}`);
    console.log(` - Quality score: ${result.qualityScore}`);
    console.log(` - Model: ${result.model}`);
    console.log(` - Latency: ${result.executionTimeMs} ms`);
  } catch (err: any) {
    console.error("❌ Test 1 failed:", err);
  }

  // 2. Test Multiple Faces Rejection
  console.log("\n[Test 2] Testing multiple faces rejection...");
  try {
    const multiBuf = fs.readFileSync(testImgPath); // test.jpg contains 2 faces
    await generateEmbedding(multiBuf, "test.jpg");
    console.error("❌ Test 2 failed: Expected MULTIPLE_FACES error but succeeded!");
  } catch (err: any) {
    if (err instanceof FastAPIError && err.code === "MULTIPLE_FACES") {
      console.log("✅ Test 2 PASSED: Multiple faces correctly rejected with MULTIPLE_FACES code.");
    } else {
      console.error("❌ Test 2 failed with unexpected error:", err);
    }
  }

  // 3. Test Zero Faces Rejection
  console.log("\n[Test 3] Testing zero faces rejection...");
  try {
    // Create simple non-face buffer
    const emptyBuf = Buffer.alloc(100);
    await generateEmbedding(emptyBuf, "empty.jpg");
    console.error("❌ Test 3 failed: Expected INVALID_IMAGE error but succeeded!");
  } catch (err: any) {
    if (err instanceof FastAPIError) {
      console.log(`✅ Test 3 PASSED: Non-face input rejected with error code '${err.code}'.`);
    } else {
      console.error("❌ Test 3 failed with unexpected error:", err);
    }
  }

  console.log("\n=== All Client Unit Tests Completed ===");
}

runTests().catch(console.error);
