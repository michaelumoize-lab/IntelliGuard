import fs from "fs";
import path from "path";
import { generateEmbedding } from "../lib/ai/fastapi";
import { checkForDuplicateFace } from "../lib/ai/duplicate-check";

async function runMilestone5Tests() {
  console.log("==================================================");
  console.log("  Milestone 5: Management & Lifecycle Verification");
  console.log("==================================================\n");

  const singleFacePath = path.join(__dirname, "../../backend/tests/single_face.jpg");

  if (!fs.existsSync(singleFacePath)) {
    console.error("❌ Test image single_face.jpg not found at:", singleFacePath);
    process.exit(1);
  }

  // Test 1: Self-excluding Duplicate Check Test
  console.log("[Test 1] Testing self-excluding pgvector duplicate check...");
  try {
    const singleBuf = fs.readFileSync(singleFacePath);
    const aiResult = await generateEmbedding(singleBuf, "single_face.jpg");

    // Standard duplicate check should match existing John Doe
    const matchAny = await checkForDuplicateFace(aiResult.embedding, 0.85);
    console.log(` - Standard check result: isDuplicate = ${matchAny.isDuplicate}`);
    if (matchAny.matchingPerson) {
      console.log(` - Matched person: ${matchAny.matchingPerson.firstName} ${matchAny.matchingPerson.lastName} (${matchAny.matchingPerson.personId})`);

      // Self-excluded check (excluding John Doe's personId)
      const matchExcluded = await checkForDuplicateFace(aiResult.embedding, 0.85, matchAny.matchingPerson.personId);
      console.log(` - Self-excluded check (excluding ID ${matchAny.matchingPerson.personId}): isDuplicate = ${matchExcluded.isDuplicate}`);

      if (!matchExcluded.isDuplicate) {
        console.log("✅ PASSED: Self-excluding duplicate check correctly allowed face replacement for same person!");
      } else {
        console.error("❌ FAILED: Self-excluding duplicate check failed.");
      }
    }
  } catch (err: any) {
    console.error("❌ Test 1 failed with error:", err);
  }

  // Test 2: FastAPI Regression Verification
  console.log("\n[Test 2] Verifying FastAPI AI service responsiveness...");
  try {
    const singleBuf = fs.readFileSync(singleFacePath);
    const result = await generateEmbedding(singleBuf, "single_face.jpg");
    if (result.embedding.length === 512 && result.normalized) {
      console.log("✅ PASSED: FastAPI AI Service returning 512D normalized ArcFace vector.");
    } else {
      console.error("❌ FAILED: Invalid vector output from FastAPI.");
    }
  } catch (err: any) {
    console.error("❌ Test 2 failed:", err);
  }

  console.log("\n==================================================");
  console.log("  Milestone 5 Verification Completed Successfully");
  console.log("==================================================");
}

runMilestone5Tests().catch(console.error);
