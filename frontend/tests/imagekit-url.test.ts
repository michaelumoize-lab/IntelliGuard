import "dotenv/config";
import { getCanonicalDeliveryUrl, uploadFaceImage, deleteFaceImage } from "../lib/ai/imagekit";

async function runImageKitUrlTests() {
  console.log("==================================================");
  console.log("  ImageKit Canonical URL Verification Tests");
  console.log("==================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assertEqual(actual: any, expected: any, testName: string) {
    if (actual === expected) {
      console.log(`✅ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      console.error(`   Expected: "${expected}"`);
      console.error(`   Actual:   "${actual}"`);
      testsFailed++;
    }
  }

  // Save current env for restore
  const originalEnvEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  // 1. Unit Test: Canonical URL generation with standard endpoint
  process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/intelliguard_demo";
  assertEqual(
    getCanonicalDeliveryUrl("/intelliguard/persons/face_123.jpg"),
    "https://ik.imagekit.io/intelliguard_demo/intelliguard/persons/face_123.jpg",
    "Test 1: Canonical URL generation with leading slash path"
  );

  // 2. Unit Test: Canonical URL generation with trailing slash in endpoint
  process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/intelliguard_demo/";
  assertEqual(
    getCanonicalDeliveryUrl("intelliguard/persons/face_456.jpg"),
    "https://ik.imagekit.io/intelliguard_demo/intelliguard/persons/face_456.jpg",
    "Test 2: Canonical URL generation with trailing slash in endpoint & no leading slash in path"
  );

  // 3. Unit Test: Custom domain endpoint
  process.env.IMAGEKIT_URL_ENDPOINT = "https://media.intelliguard.com/";
  assertEqual(
    getCanonicalDeliveryUrl("/intelliguard/persons/face_789.jpg"),
    "https://media.intelliguard.com/intelliguard/persons/face_789.jpg",
    "Test 3: Canonical URL generation with custom CNAME domain"
  );

  // Restore original env endpoint
  process.env.IMAGEKIT_URL_ENDPOINT = originalEnvEndpoint;

  // 4. Integration Test: Real ImageKit upload canonical URL return (if credentials configured)
  console.log("\n[Test 4] Testing uploadFaceImage output format...");
  try {
    const dummyImageBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xd9
    ]);

    const result = await uploadFaceImage(dummyImageBuffer, "test_canonical_check.jpg");
    const expectedUrl = getCanonicalDeliveryUrl(result.filePath);

    assertEqual(
      result.url,
      expectedUrl,
      "Test 4: uploadFaceImage returns canonical delivery URL matching IMAGEKIT_URL_ENDPOINT"
    );

    console.log(` - Returned URL:  ${result.url}`);
    console.log(` - File ID:       ${result.fileId}`);
    console.log(` - Relative Path: ${result.filePath}`);

    // Clean up uploaded test asset using fileId
    if (result.fileId) {
      console.log("\n[Test 5] Testing deleteFaceImage using fileId...");
      const deleted = await deleteFaceImage(result.fileId);
      assertEqual(deleted, true, "Test 5: deleteFaceImage succeeds using fileId");
    }
  } catch (err: any) {
    console.warn("⚠️ Skipping live ImageKit upload/delete test (missing network/credentials or API error):", err.message || err);
  }

  console.log("\n==================================================");
  console.log(`  Passed: ${testsPassed} | Failed: ${testsFailed}`);
  if (testsFailed > 0) {
    console.error("  ImageKit URL Verification Failed");
    process.exitCode = 1;
  } else {
    console.log("  ImageKit URL Verification Completed Successfully");
  }
  console.log("==================================================");
}

runImageKitUrlTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exitCode = 1;
});
