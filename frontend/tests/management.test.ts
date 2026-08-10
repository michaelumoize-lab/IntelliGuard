import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
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

  let createdPersonId: number | null = null;

  // Test 1: Self-excluding Duplicate Check Test
  console.log("[Test 1] Testing self-excluding pgvector duplicate check...");
  try {
    const singleBuf = fs.readFileSync(singleFacePath);
    const aiResult = await generateEmbedding(singleBuf, "single_face.jpg");

    // Check if face already exists in DB, otherwise seed a temporary test person
    let matchAny = await checkForDuplicateFace(aiResult.embedding, 0.85);

    if (!matchAny.isDuplicate || !matchAny.matchingPerson) {
      console.log(" - Seeding temporary test person for self-exclusion test...");
      const testPerson = await prisma.person.create({
        data: {
          personCode: `TEST-MGMT-${Date.now()}`,
          firstName: "TestMgmt",
          lastName: "User",
          category: "employee",
          status: "active",
        },
      });
      createdPersonId = testPerson.id;

      const vectorLiteral = `[${aiResult.embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO face_embeddings (
          person_id, embedding, embedding_model, image_path, quality_score, is_active, created_at, updated_at
        ) VALUES (
          $1, $2::vector, $3, $4, $5, true, NOW(), NOW()
        );
        `,
        testPerson.id,
        vectorLiteral,
        aiResult.model || "Buffalo_L",
        "/test_face.jpg",
        aiResult.qualityScore
      );

      matchAny = await checkForDuplicateFace(aiResult.embedding, 0.85);
    }

    console.log(` - Standard check result: isDuplicate = ${matchAny.isDuplicate}`);
    if (matchAny.matchingPerson) {
      console.log(` - Matched person: ${matchAny.matchingPerson.firstName} ${matchAny.matchingPerson.lastName} (${matchAny.matchingPerson.personId})`);

      // Self-excluded check (excluding matched person's personId)
      const matchExcluded = await checkForDuplicateFace(aiResult.embedding, 0.85, matchAny.matchingPerson.personId);
      console.log(` - Self-excluded check (excluding ID ${matchAny.matchingPerson.personId}): isDuplicate = ${matchExcluded.isDuplicate}`);

      if (!matchExcluded.isDuplicate) {
        console.log("✅ PASSED: Self-excluding duplicate check correctly allowed face replacement for same person!");
      } else {
        console.error("❌ FAILED: Self-excluding duplicate check failed.");
        process.exitCode = 1;
      }
    } else {
      console.error("❌ FAILED: Could not find or seed matching face for duplicate test.");
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error("❌ Test 1 failed with error:", err);
    process.exitCode = 1;
  } finally {
    if (createdPersonId) {
      await prisma.faceEmbedding.deleteMany({ where: { personId: createdPersonId } }).catch(() => {});
      await prisma.person.delete({ where: { id: createdPersonId } }).catch(() => {});
    }
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
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error("❌ Test 2 failed:", err);
    process.exitCode = 1;
  }

  console.log("\n==================================================");
  if (process.exitCode === 1) {
    console.error("  Milestone 5 Verification Failed");
  } else {
    console.log("  Milestone 5 Verification Completed Successfully");
  }
  console.log("==================================================");
}

runMilestone5Tests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exitCode = 1;
});
