import {
  IDENTIFIER_PREFIXES,
  SUFFIX_DIGIT_LENGTH,
  PERSON_CODE_PATTERN,
  DEVICE_CODE_PATTERN,
  EMBEDDING_CODE_PATTERN,
  ACCESS_CODE_PATTERN,
  ALERT_CODE_PATTERN,
  BUSINESS_ID_PATTERN,
  generatePersonCode,
  generateDeviceCode,
  generateFaceEmbeddingCode,
  generateEmbeddingCode,
  generateAlertCode,
  generateAccessLogCode,
  generateAccessCode,
  isValidPersonCode,
  isValidDeviceCode,
  isValidEmbeddingCode,
  isValidAccessCode,
  isValidAlertCode,
  isValidBusinessIdentifier,
  getIdentifierPrefix,
  generateUniqueBusinessIdentifier,
} from "../lib/identifiers";
import { formatCompactTimestamp } from "../components/ui/formatted-timestamp";

async function runIdentifierTests() {
  console.log("==================================================");
  console.log("  Business Identifiers & Timestamp Unit Tests");
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

  // 1. Prefix & Length Verification
  console.log("[Test 1] Verifying Entity Prefix Constants & 6-Digit Specification...");
  assert(IDENTIFIER_PREFIXES.PERSON === "PER-", "Person prefix is 'PER-'");
  assert(IDENTIFIER_PREFIXES.DEVICE === "DEV-", "Device prefix is 'DEV-'");
  assert(IDENTIFIER_PREFIXES.FACE_EMBEDDING === "EMB-", "FaceEmbedding prefix is 'EMB-'");
  assert(IDENTIFIER_PREFIXES.ACCESS_LOG === "ASL-", "AccessLog prefix is 'ASL-' (not ACL-)");
  assert(IDENTIFIER_PREFIXES.ALERT === "ALT-", "Alert prefix is 'ALT-'");
  assert(SUFFIX_DIGIT_LENGTH === 6, "SUFFIX_DIGIT_LENGTH is strictly 6 numeric digits");

  // 2. Generator Function Formats
  console.log("\n[Test 2] Testing Generator Outputs & Format Structure...");
  const perCode = generatePersonCode();
  const devCode = generateDeviceCode();
  const embCode = generateFaceEmbeddingCode();
  const aslCode = generateAccessLogCode();
  const altCode = generateAlertCode();

  console.log(` - Person Code:        ${perCode}`);
  console.log(` - Device Code:        ${devCode}`);
  console.log(` - FaceEmbedding Code: ${embCode}`);
  console.log(` - AccessLog Code:     ${aslCode}`);
  console.log(` - Alert Code:         ${altCode}`);

  assert(PERSON_CODE_PATTERN.test(perCode), `generatePersonCode() matches ^PER-[0-9]{6}$ (${perCode})`);
  assert(DEVICE_CODE_PATTERN.test(devCode), `generateDeviceCode() matches ^DEV-[0-9]{6}$ (${devCode})`);
  assert(EMBEDDING_CODE_PATTERN.test(embCode), `generateFaceEmbeddingCode() matches ^EMB-[0-9]{6}$ (${embCode})`);
  assert(EMBEDDING_CODE_PATTERN.test(generateEmbeddingCode()), "generateEmbeddingCode() matches ^EMB-[0-9]{6}$");
  assert(ACCESS_CODE_PATTERN.test(aslCode), `generateAccessLogCode() matches ^ASL-[0-9]{6}$ (${aslCode})`);
  assert(ACCESS_CODE_PATTERN.test(generateAccessCode()), "generateAccessCode() matches ^ASL-[0-9]{6}$");
  assert(ALERT_CODE_PATTERN.test(altCode), `generateAlertCode() matches ^ALT-[0-9]{6}$ (${altCode})`);
  assert(BUSINESS_ID_PATTERN.test(perCode) && BUSINESS_ID_PATTERN.test(aslCode), "BUSINESS_ID_PATTERN matches valid codes");

  // Suffix length verification (6 numeric digits after 4-char prefix = 10 total chars)
  assert(perCode.length === 10, `Total length is 10 chars (${perCode.length})`);
  const numericPart = perCode.slice(4);
  assert(/^[0-9]{6}$/.test(numericPart), "Suffix consists of exactly 6 numeric digits (0-9)");

  // 3. Cryptographic Randomness & Distribution
  console.log("\n[Test 3] Verifying Cryptographic Randomness in Batch...");
  const sampleSize = 500;
  const set = new Set<string>();
  for (let i = 0; i < sampleSize; i++) {
    const code = generatePersonCode();
    if (!PERSON_CODE_PATTERN.test(code)) {
      throw new Error(`Invalid generated code in batch: ${code}`);
    }
    set.add(code);
  }
  assert(set.size >= sampleSize - 2, `Generated ${set.size}/${sampleSize} unique 6-digit person codes`);

  // 4. Entity-Specific & General Validation Helpers
  console.log("\n[Test 4] Testing Entity Validators & isValidBusinessIdentifier...");
  assert(isValidPersonCode("PER-482910"), "isValidPersonCode accepts 'PER-482910'");
  assert(isValidPersonCode("PER-000001"), "isValidPersonCode accepts leading zeros 'PER-000001'");
  assert(!isValidPersonCode("PER-48291"), "isValidPersonCode rejects 5-digit code 'PER-48291'");
  assert(!isValidPersonCode("PER-4829100"), "isValidPersonCode rejects 7-digit code 'PER-4829100'");
  assert(!isValidPersonCode("PER-48291A"), "isValidPersonCode rejects hex/alpha characters 'PER-48291A'");
  assert(!isValidPersonCode("DEV-482910"), "isValidPersonCode rejects wrong prefix 'DEV-482910'");

  assert(isValidDeviceCode("DEV-918273"), "isValidDeviceCode accepts 'DEV-918273'");
  assert(isValidEmbeddingCode("EMB-123456"), "isValidEmbeddingCode accepts 'EMB-123456'");
  assert(isValidAccessCode("ASL-456789"), "isValidAccessCode accepts 'ASL-456789'");
  assert(!isValidAccessCode("ACL-456789"), "isValidAccessCode rejects obsolete 'ACL-456789'");
  assert(isValidAlertCode("ALT-987654"), "isValidAlertCode accepts 'ALT-987654'");

  assert(isValidBusinessIdentifier(perCode, "PER-"), "Validates newly generated PER- code");
  assert(isValidBusinessIdentifier("DEV-918273", "DEV-"), "Validates 6-digit DEV- code with DEV- prefix");
  assert(!isValidBusinessIdentifier("DEV-918273", "PER-"), "Rejects DEV- code when expecting PER- prefix");
  assert(!isValidBusinessIdentifier("PER-17BF059C1234"), "Rejects legacy 12-char hex code");
  assert(!isValidBusinessIdentifier("ACL-123456"), "Rejects obsolete ACL- prefix");
  assert(!isValidBusinessIdentifier(null), "Rejects null");
  assert(!isValidBusinessIdentifier(undefined), "Rejects undefined");
  assert(!isValidBusinessIdentifier(123456), "Rejects numbers");

  // 5. Prefix Extraction
  console.log("\n[Test 5] Testing getIdentifierPrefix...");
  assert(getIdentifierPrefix("PER-482910") === "PER-", "Extracts 'PER-'");
  assert(getIdentifierPrefix("ASL-456789") === "ASL-", "Extracts 'ASL-'");
  assert(getIdentifierPrefix("ACL-456789") === null, "Returns null for obsolete 'ACL-' prefix");
  assert(getIdentifierPrefix("UNKNOWN-123456") === null, "Returns null for unknown prefix");

  // 6. Collision Retry Mechanism
  console.log("\n[Test 6] Testing Collision Avoidance Retry Handler...");
  let attemptCount = 0;
  const mockExistingSet = new Set<string>();

  const successfulCandidate = await generateUniqueBusinessIdentifier(
    () => {
      attemptCount++;
      if (attemptCount <= 2) {
        return "ALT-000000";
      }
      return generateAlertCode();
    },
    async (code) => {
      if (code === "ALT-000000") return true;
      return mockExistingSet.has(code);
    },
    { maxRetries: 5, entityName: "Alert" }
  );

  assert(attemptCount === 3, "Retried 2 colliding attempts and succeeded on attempt 3");
  assert(ALERT_CODE_PATTERN.test(successfulCandidate), "Generated valid unique Alert code after retries");

  // 7. Verify Retry Exhaustion
  console.log("\n[Test 7] Testing Collision Retry Exhaustion Error...");
  let errorCaught = false;
  try {
    await generateUniqueBusinessIdentifier(
      () => "DEV-000000",
      async () => true,
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

  // 8. Compact Timestamp Formatting Verification
  console.log("\n[Test 8] Testing Compact Timestamp Formatter (DD MMM YYYY, HH:mm)...");
  const sampleDate = new Date(2026, 10, 3, 14, 35, 49); // Local: 03 Nov 2026, 14:35:49
  const formattedDateTime = formatCompactTimestamp(sampleDate, { mode: "datetime" });
  const formattedDateOnly = formatCompactTimestamp(sampleDate, { mode: "date" });
  const formattedTimeOnly = formatCompactTimestamp(sampleDate, { mode: "time" });

  console.log(` - datetime: "${formattedDateTime}"`);
  console.log(` - date:     "${formattedDateOnly}"`);
  console.log(` - time:     "${formattedTimeOnly}"`);

  assert(formattedDateTime === "03 Nov 2026, 14:35", "datetime mode formats as '03 Nov 2026, 14:35'");
  assert(formattedDateOnly === "03 Nov 2026", "date mode formats as '03 Nov 2026'");
  assert(formattedTimeOnly === "14:35", "time mode formats as '14:35'");
  assert(Boolean(formattedDateTime) && !formattedDateTime!.includes(":49"), "Default datetime omits seconds");
  assert(
    Boolean(formattedDateTime) && !formattedDateTime!.includes("GMT") && !formattedDateTime!.includes("UTC"),
    "Default datetime omits GMT and UTC timezone text"
  );

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
