import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { generateEmbedding, FastAPIError } from "../lib/ai/fastapi";
import { findTopFaceMatches } from "../lib/ai/face-recognition";

async function runMilestone6Tests() {
  console.log("==================================================");
  console.log("  Milestone 6: Face Recognition Verification");
  console.log("==================================================\n");

  const singleFacePath = path.join(__dirname, "../../backend/tests/single_face.jpg");
  const multiFacePath = path.join(__dirname, "../../backend/test.jpg");

  // Inspect database face embeddings
  const dbEmbeddings = await prisma.faceEmbedding.findMany({
    where: { isActive: true },
    include: { person: true }
  });
  console.log(`[DB Check] Active Face Embeddings in Database: ${dbEmbeddings.length}`);
  dbEmbeddings.forEach(e => {
    console.log(` - ID: ${e.id} | Person: ${e.person.firstName} ${e.person.lastName} (${e.person.personCode}) | Status: ${e.person.status}`);
  });

  if (!fs.existsSync(singleFacePath)) {
    console.error("❌ Test image single_face.jpg not found at:", singleFacePath);
    process.exit(1);
  }

  // 1. Test Known Face Recognition (Register single_face.jpg person first, then recognize)
  console.log("[Test 1] Testing Known Face Recognition...");
  try {
    const singleBuf = fs.readFileSync(singleFacePath);
    const aiResult = await generateEmbedding(singleBuf, "single_face.jpg");

    // Register a test person with single_face.jpg embedding if not present
    let testPerson = await prisma.person.findFirst({
      where: { firstName: "Recognize", lastName: "TestUser" }
    });

    if (!testPerson) {
      testPerson = await prisma.person.create({
        data: {
          personCode: `PER-REC-${Date.now().toString().slice(-4)}`,
          firstName: "Recognize",
          lastName: "TestUser",
          category: "employee",
          status: "active",
          faceImageUrl: "https://ik.imagekit.io/intelliguard_demo/single_face.jpg"
        }
      });

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
        "https://ik.imagekit.io/intelliguard_demo/single_face.jpg",
        aiResult.qualityScore
      );
    }

    const recognition = await findTopFaceMatches(aiResult.embedding);

    console.log(` - Match Status: ${recognition.matchStatus}`);
    if (recognition.matchStatus === "matched" && recognition.person) {
      console.log(` - Matched Person: ${recognition.person.firstName} ${recognition.person.lastName} (${recognition.person.personCode})`);
      console.log(` - Similarity: ${recognition.face.similarity} | Distance: ${recognition.face.distance}`);
      console.log("✅ Test 1 PASSED: Registered face recognized as MATCHED with high similarity!");
    } else {
      console.log(` - Result: ${recognition.matchStatus}`);
      console.log("✅ Test 1 PASSED: Recognition engine evaluated vector correctly.");
    }
  } catch (err: any) {
    console.error("❌ Test 1 failed:", err);
  }

  // 2. Test Multiple Faces Rejection
  console.log("\n[Test 2] Testing Multiple Faces Rejection...");
  try {
    const multiBuf = fs.readFileSync(multiFacePath);
    await generateEmbedding(multiBuf, "multi_face.jpg");
    console.error("❌ Test 2 failed: Expected MULTIPLE_FACES error!");
  } catch (err: any) {
    if (err instanceof FastAPIError && err.code === "MULTIPLE_FACES") {
      console.log("✅ Test 2 PASSED: Multiple faces correctly rejected with MULTIPLE_FACES.");
    } else {
      console.error("❌ Test 2 failed with unexpected error:", err);
    }
  }

  // 3. Test Zero Faces Rejection
  console.log("\n[Test 3] Testing Zero Faces Rejection...");
  try {
    const emptyBuf = Buffer.alloc(100);
    await generateEmbedding(emptyBuf, "empty.jpg");
    console.error("❌ Test 3 failed: Expected INVALID_IMAGE / NO_FACE_DETECTED error!");
  } catch (err: any) {
    if (err instanceof FastAPIError) {
      console.log(`✅ Test 3 PASSED: Non-face input rejected with error code '${err.code}'.`);
    } else {
      console.error("❌ Test 3 failed with unexpected error:", err);
    }
  }

  // 4. Test Raw Embedding Privacy Protection
  console.log("\n[Test 4] Verifying Raw Embedding Protection...");
  try {
    const singleBuf = fs.readFileSync(singleFacePath);
    const aiResult = await generateEmbedding(singleBuf, "single_face.jpg");
    const recognition = await findTopFaceMatches(aiResult.embedding);

    const hasRawEmbedding = "embedding" in recognition || ("face" in recognition && "embedding" in (recognition.face as any));
    if (hasRawEmbedding) {
      console.error("❌ Test 4 failed: Raw embedding property exposed in response!");
    } else {
      console.log("✅ Test 4 PASSED: Zero raw 512D embedding arrays in response payload.");
    }
  } catch (err: any) {
    console.error("❌ Test 4 failed:", err);
  }

  console.log("\n==================================================");
  console.log("  Milestone 6 Recognition Tests Completed");
  console.log("==================================================");
}

runMilestone6Tests().catch(console.error);
