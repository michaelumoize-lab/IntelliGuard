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
    process.exitCode = 1;
  }

  // 2. Test Multiple Faces Rejection
  console.log("\n[Test 2] Testing multiple faces rejection...");
  try {
    const multiBuf = fs.readFileSync(testImgPath); // test.jpg contains 2 faces
    await generateEmbedding(multiBuf, "test.jpg");
    console.error("❌ Test 2 failed: Expected MULTIPLE_FACES error but succeeded!");
    process.exitCode = 1;
  } catch (err: any) {
    if (err instanceof FastAPIError && err.code === "MULTIPLE_FACES") {
      console.log("✅ Test 2 PASSED: Multiple faces correctly rejected with MULTIPLE_FACES code.");
    } else {
      console.error("❌ Test 2 failed with unexpected error:", err);
      process.exitCode = 1;
    }
  }

  // 3. Test Zero Faces Rejection
  console.log("\n[Test 3] Testing zero faces rejection...");
  try {
    // Valid 1x1 JPEG image containing no face
    const noFaceJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbe, 0x00, 0xff, 0xd9
    ]);
    await generateEmbedding(noFaceJpeg, "noface.jpg");
    console.error("❌ Test 3 failed: Expected NO_FACE_DETECTED error but succeeded!");
    process.exitCode = 1;
  } catch (err: any) {
    if (err instanceof FastAPIError && err.code === "NO_FACE_DETECTED") {
      console.log(`✅ Test 3 PASSED: Non-face image correctly rejected with error code '${err.code}'.`);
    } else {
      console.error("❌ Test 3 failed with unexpected error:", err);
      process.exitCode = 1;
    }
  }

  console.log("\n=== All Client Unit Tests Completed ===");
}

runTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exitCode = 1;
});
