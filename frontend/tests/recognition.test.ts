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

  let createdTestPersonId: number | null = null;

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
      createdTestPersonId = testPerson.id;

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
      console.error(`❌ Test 1 FAILED: Expected matchStatus='matched' but got '${recognition.matchStatus}'`);
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error("❌ Test 1 failed:", err);
    process.exitCode = 1;
  } finally {
    if (createdTestPersonId) {
      await prisma.faceEmbedding.deleteMany({ where: { personId: createdTestPersonId } }).catch(() => {});
      await prisma.person.delete({ where: { id: createdTestPersonId } }).catch(() => {});
    }
  }

  // 2. Test Multiple Faces Rejection
  console.log("\n[Test 2] Testing Multiple Faces Rejection...");
  try {
    const multiBuf = fs.readFileSync(multiFacePath);
    await generateEmbedding(multiBuf, "multi_face.jpg");
    console.error("❌ Test 2 failed: Expected MULTIPLE_FACES error!");
    process.exitCode = 1;
  } catch (err: any) {
    if (err instanceof FastAPIError && err.code === "MULTIPLE_FACES") {
      console.log("✅ Test 2 PASSED: Multiple faces correctly rejected with MULTIPLE_FACES.");
    } else {
      console.error("❌ Test 2 failed with unexpected error:", err);
      process.exitCode = 1;
    }
  }

  // 3. Test Zero Faces Rejection
  console.log("\n[Test 3] Testing Zero Faces Rejection...");
  try {
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
    console.error("❌ Test 3 failed: Expected NO_FACE_DETECTED error!");
    process.exitCode = 1;
  } catch (err: any) {
    if (err instanceof FastAPIError && err.code === "NO_FACE_DETECTED") {
      console.log(`✅ Test 3 PASSED: Non-face input rejected with error code '${err.code}'.`);
    } else {
      console.error("❌ Test 3 failed with unexpected error:", err);
      process.exitCode = 1;
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
      process.exitCode = 1;
    } else {
      console.log("✅ Test 4 PASSED: Zero raw 512D embedding arrays in response payload.");
    }
  } catch (err: any) {
    console.error("❌ Test 4 failed:", err);
    process.exitCode = 1;
  }

  console.log("\n==================================================");
  if (process.exitCode === 1) {
    console.error("  Milestone 6 Recognition Tests Failed");
  } else {
    console.log("  Milestone 6 Recognition Tests Completed Successfully");
  }
  console.log("==================================================");
}

runMilestone6Tests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exitCode = 1;
});
