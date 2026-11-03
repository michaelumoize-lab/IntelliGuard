import {
  IDENTIFIER_PREFIXES,
  generatePersonCode,
  generateDeviceCode,
  generateFaceEmbeddingCode,
  generateEmbeddingCode,
  generateRecognitionEventCode,
  generateAlertCode,
  generateAccessLogCode,
  generateAccessCode,
  isValidBusinessIdentifier,
  getIdentifierPrefix,
  generateUniqueBusinessIdentifier,
  SUFFIX_HEX_LENGTH,
} from "../lib/identifiers";

async function runIdentifierTests() {
  console.log("==================================================");
  console.log("  Business Identifiers Unit Tests");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. Prefix Verification
  console.log("[Test 1] Verifying Entity Prefix Constants...");
  assert(IDENTIFIER_PREFIXES.PERSON === "PER-", "Person prefix is 'PER-'");
  assert(IDENTIFIER_PREFIXES.DEVICE === "DEV-", "Device prefix is 'DEV-'");
  assert(IDENTIFIER_PREFIXES.FACE_EMBEDDING === "EMB-", "FaceEmbedding prefix is 'EMB-'");
  assert(IDENTIFIER_PREFIXES.RECOGNITION_EVENT === "REC-", "RecognitionEvent prefix is 'REC-'");
  assert(IDENTIFIER_PREFIXES.ALERT === "ALT-", "Alert prefix is 'ALT-'");
  assert(IDENTIFIER_PREFIXES.ACCESS_LOG === "ACL-", "AccessLog prefix is 'ACL-'");

  // 2. Generator Function Formats
  console.log("\n[Test 2] Testing Generator Outputs & Format Structure...");
  const perCode = generatePersonCode();
  const devCode = generateDeviceCode();
  const embCode = generateFaceEmbeddingCode();
  const recCode = generateRecognitionEventCode();
  const altCode = generateAlertCode();
  const aclCode = generateAccessLogCode();

  console.log(` - Person Code:            ${perCode}`);
  console.log(` - Device Code:            ${devCode}`);
  console.log(` - FaceEmbedding Code:     ${embCode}`);
  console.log(` - RecognitionEvent Code:  ${recCode}`);
  console.log(` - Alert Code:             ${altCode}`);
  console.log(` - AccessLog Code:         ${aclCode}`);

  assert(perCode.startsWith("PER-"), "generatePersonCode() starts with 'PER-'");
  assert(devCode.startsWith("DEV-"), "generateDeviceCode() starts with 'DEV-'");
  assert(embCode.startsWith("EMB-"), "generateFaceEmbeddingCode() starts with 'EMB-'");
  assert(generateEmbeddingCode().startsWith("EMB-"), "generateEmbeddingCode() starts with 'EMB-'");
  assert(recCode.startsWith("REC-"), "generateRecognitionEventCode() starts with 'REC-'");
  assert(altCode.startsWith("ALT-"), "generateAlertCode() starts with 'ALT-'");
  assert(aclCode.startsWith("ACL-"), "generateAccessLogCode() starts with 'ACL-'");
  assert(generateAccessCode().startsWith("ACL-"), "generateAccessCode() starts with 'ACL-'");

  // Suffix length verification (12 hex chars after 4 char prefix = 16 total chars)
  assert(perCode.length === 4 + SUFFIX_HEX_LENGTH, `Length is 16 chars (${perCode.length})`);
  const hexPart = perCode.slice(4);
  assert(/^[0-9A-F]{12}$/.test(hexPart), "Suffix consists of 12 uppercase hexadecimal characters");

  // 3. Cryptographic Randomness & Entropy
  console.log("\n[Test 3] Verifying Randomness & Zero Collisions in Batch...");
  const sampleSize = 1000;
  const set = new Set<string>();
  for (let i = 0; i < sampleSize; i++) {
    set.add(generatePersonCode());
  }
  assert(set.size === sampleSize, `Generated ${sampleSize} unique person codes with zero collisions`);

  // 4. Validation Helper
  console.log("\n[Test 4] Testing isValidBusinessIdentifier Helper...");
  assert(isValidBusinessIdentifier(perCode, "PER-"), "Validates newly generated PER- code");
  assert(isValidBusinessIdentifier("PER-17BF059C1234"), "Validates 12-char PER- code without prefix argument");
  assert(isValidBusinessIdentifier("PER-17BF059C"), "Validates legacy 8-char PER- code");
  assert(isValidBusinessIdentifier("DEV-7A2D19F4B620", "DEV-"), "Validates 12-char DEV- code with DEV- prefix");
  assert(!isValidBusinessIdentifier("DEV-7A2D19F4B620", "PER-"), "Rejects DEV- code when expecting PER- prefix");
  assert(!isValidBusinessIdentifier("INVALID-CODE"), "Rejects invalid prefix format");
  assert(!isValidBusinessIdentifier("PER-12345"), "Rejects too short suffix (<8 hex chars)");
  assert(!isValidBusinessIdentifier("PER-ZZZZZZZZZZZZ"), "Rejects non-hex characters");
  assert(!isValidBusinessIdentifier(null), "Rejects null");
  assert(!isValidBusinessIdentifier(undefined), "Rejects undefined");
  assert(!isValidBusinessIdentifier(12345), "Rejects numbers");

  // 5. Prefix Extraction
  console.log("\n[Test 5] Testing getIdentifierPrefix...");
  assert(getIdentifierPrefix("PER-1234567890AB") === "PER-", "Extracts 'PER-'");
  assert(getIdentifierPrefix("DEV-1234567890AB") === "DEV-", "Extracts 'DEV-'");
  assert(getIdentifierPrefix("UNKNOWN-123") === null, "Returns null for unknown prefix");

  // 6. Collision Retry Mechanism
  console.log("\n[Test 6] Testing Collision Avoidance Retry Handler...");
  let attemptCount = 0;
  const mockExistingSet = new Set<string>();

  const successfulCandidate = await generateUniqueBusinessIdentifier(
    () => {
      attemptCount++;
      // Simulate collision for the first 2 attempts
      if (attemptCount <= 2) {
        return "COLLIDE-CODE";
      }
      return generateAlertCode();
    },
    async (code) => {
      if (code === "COLLIDE-CODE") return true; // Pretend it exists
      return mockExistingSet.has(code);
    },
    { maxRetries: 5, entityName: "Alert" }
  );

  assert(attemptCount === 3, "Retried 2 colliding attempts and succeeded on attempt 3");
  assert(successfulCandidate.startsWith("ALT-"), "Generated valid unique Alert code after retries");

  // Verify retry exhaustion
  console.log("\n[Test 7] Testing Collision Retry Exhaustion Error...");
  let errorCaught = false;
  try {
    await generateUniqueBusinessIdentifier(
      () => "PERMANENT-COLLISION",
      async () => true, // Always exists
      { maxRetries: 3, entityName: "Device" }
    );
  } catch (err) {
    errorCaught = true;
    assert(
      err instanceof Error && err.message.includes("Failed to generate unique business identifier"),
      "Throws error on exhausted retries"
    );
  }
  assert(errorCaught, "Exhausted retry error was thrown as expected");

  console.log("\n==================================================");
  console.log(`  Results: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runIdentifierTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
