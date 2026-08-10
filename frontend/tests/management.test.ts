import fs from "fs";
import path from "path";
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { generateEmbedding } from "../lib/ai/fastapi";
import { checkForDuplicateFace } from "../lib/ai/duplicate-check";
import { uploadFaceImage, deleteFaceImage, getImageFileDetails } from "../lib/ai/imagekit";

async function runMilestone5Tests() {
  console.log("==================================================");
  console.log("  Milestone 5: Management & Lifecycle Verification");
  console.log("==================================================\n");

  const singleFacePath = path.join(__dirname, "../../backend/tests/single_face.jpg");
  const noFacePath = path.join(__dirname, "../../backend/tests/no_face.jpg");

  if (!fs.existsSync(singleFacePath)) {
    console.error("❌ Test image single_face.jpg not found at:", singleFacePath);
    process.exit(1);
  }

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
      testsFailed++;
      process.exitCode = 1;
    }
  }

  let createdPersonId: number | null = null;
  let createdFileId: string | null = null;

  try {
    // ----------------------------------------------------
    // Test 1: FastAPI AI Embedding & Validation
    // ----------------------------------------------------
    console.log("[Test 1] Testing 512D ArcFace embedding generation...");
    const singleBuf = fs.readFileSync(singleFacePath);
    const aiResult = await generateEmbedding(singleBuf, "single_face.jpg");

    assert(
      aiResult.embedding.length === 512 && aiResult.normalized === true,
      "Test 1: FastAPI returns 512D L2-normalized vector",
      `Dimension: ${aiResult.embedding.length}`
    );
    assert(
      aiResult.qualityScore >= 0.50,
      "Test 1: Quality score meets minimum threshold (0.50)",
      `Quality: ${aiResult.qualityScore}`
    );

    // ----------------------------------------------------
    // Test 2: ImageKit Upload & Canonical URL Consistency
    // ----------------------------------------------------
    console.log("\n[Test 2] Testing ImageKit upload & single source of truth URL consistency...");
    const ikResult = await uploadFaceImage(singleBuf, "m5_test_face.jpg");
    createdFileId = ikResult.fileId;

    assert(Boolean(ikResult.url), "Test 2: ImageKit returned delivery URL");
    assert(Boolean(ikResult.fileId), "Test 2: ImageKit returned fileId");

    // Create test person in DB using ikResult.url for both faceImageUrl & FaceEmbedding.imagePath
    const personCode = `TEST-M5-${Date.now()}`;
    const newPerson = await prisma.$transaction(async (tx) => {
      const p = await tx.person.create({
        data: {
          personCode,
          firstName: "Alice",
          lastName: "Wonderland",
          email: `alice_${Date.now()}@example.com`,
          phone: `+1-555-${Math.floor(1000 + Math.random() * 9000)}`,
          category: "employee",
          department: "Cybersecurity",
          status: "active",
          faceImageUrl: ikResult.url,
          faceImageFileId: ikResult.fileId,
          notes: "Milestone 5 test user",
        },
      });

      const vectorLiteral = `[${aiResult.embedding.join(",")}]`;
      await tx.$executeRawUnsafe(
        `
        INSERT INTO face_embeddings (
          person_id, embedding, embedding_model, image_path, quality_score, is_active, created_at, updated_at
        ) VALUES (
          $1, $2::vector, $3, $4, $5, true, NOW(), NOW()
        );
        `,
        p.id,
        vectorLiteral,
        aiResult.model || "Buffalo_L",
        ikResult.url,
        aiResult.qualityScore
      );

      return p;
    });

    createdPersonId = newPerson.id;

    // Verify Person and FaceEmbedding in PostgreSQL
    const fetchedPerson = await prisma.person.findUnique({
      where: { id: newPerson.id },
      include: { faceEmbeddings: { where: { isActive: true } } },
    });

    assert(fetchedPerson !== null, "Test 2: Person created in database");
    assert(
      fetchedPerson?.faceImageUrl === ikResult.url,
      "Test 2: Person.faceImageUrl matches ImageKit delivery URL directly"
    );
    assert(
      fetchedPerson?.faceImageFileId === ikResult.fileId,
      "Test 2: Person.faceImageFileId matches ImageKit fileId"
    );
    assert(
      fetchedPerson?.faceEmbeddings[0]?.imagePath === ikResult.url,
      "Test 2: FaceEmbedding.imagePath matches Person.faceImageUrl exactly"
    );

    // ----------------------------------------------------
    // Test 3: Self-Exclusion Duplicate Check
    // ----------------------------------------------------
    console.log("\n[Test 3] Testing pgvector duplicate check with self-exclusion...");
    const globalCheck = await checkForDuplicateFace(aiResult.embedding, 0.85);
    assert(globalCheck.isDuplicate === true, "Test 3: Global check detects duplicate face");

    const selfExcludedCheck = await checkForDuplicateFace(aiResult.embedding, 0.85, newPerson.id);
    assert(
      selfExcludedCheck.isDuplicate === false,
      "Test 3: Self-excluded check (excluding person.id) allows face replacement for same individual"
    );

    // ----------------------------------------------------
    // Test 4: Face Replacement & Embedding Lifecycle
    // ----------------------------------------------------
    console.log("\n[Test 4] Testing face replacement & embedding lifecycle...");
    const replacementIkResult = await uploadFaceImage(singleBuf, "m5_replacement_face.jpg");
    const oldFileId = ikResult.fileId;
    createdFileId = replacementIkResult.fileId; // Update tracking for final cleanup

    const replacementAiResult = await generateEmbedding(singleBuf, "m5_replacement_face.jpg");

    // Perform replacement transaction
    await prisma.$transaction(async (tx) => {
      // Deactivate old embeddings
      await tx.faceEmbedding.updateMany({
        where: { personId: newPerson.id, isActive: true },
        data: { isActive: false },
      });

      // Insert new active embedding
      const vectorLiteral = `[${replacementAiResult.embedding.join(",")}]`;
      await tx.$executeRawUnsafe(
        `
        INSERT INTO face_embeddings (
          person_id, embedding, embedding_model, image_path, quality_score, is_active, created_at, updated_at
        ) VALUES (
          $1, $2::vector, $3, $4, $5, true, NOW(), NOW()
        );
        `,
        newPerson.id,
        vectorLiteral,
        replacementAiResult.model || "Buffalo_L",
        replacementIkResult.url,
        replacementAiResult.qualityScore
      );

      // Update Person
      await tx.person.update({
        where: { id: newPerson.id },
        data: {
          faceImageUrl: replacementIkResult.url,
          faceImageFileId: replacementIkResult.fileId,
        },
      });
    });

    // Delete old ImageKit asset after transaction succeeds
    await deleteFaceImage(oldFileId);

    const updatedPerson = await prisma.person.findUnique({
      where: { id: newPerson.id },
      include: { faceEmbeddings: { orderBy: { createdAt: "desc" } } },
    });

    assert(
      updatedPerson?.faceImageUrl === replacementIkResult.url,
      "Test 4: Person.faceImageUrl updated to new ImageKit URL"
    );
    assert(
      updatedPerson?.faceImageFileId === replacementIkResult.fileId,
      "Test 4: Person.faceImageFileId updated to new ImageKit fileId"
    );
    assert(
      updatedPerson?.faceEmbeddings.length === 2,
      "Test 4: Embedding history retains both old and new embeddings"
    );

    const activeEmbs = updatedPerson?.faceEmbeddings.filter((e) => e.isActive) || [];
    const inactiveEmbs = updatedPerson?.faceEmbeddings.filter((e) => !e.isActive) || [];

    assert(activeEmbs.length === 1, "Test 4: Exactly one face embedding is currently active");
    assert(
      activeEmbs[0]?.imagePath === replacementIkResult.url,
      "Test 4: Active FaceEmbedding.imagePath matches new Person.faceImageUrl"
    );
    assert(inactiveEmbs.length === 1, "Test 4: Old face embedding marked as isActive = false");

    // ----------------------------------------------------
    // Test 5: Search & Full Name Queries
    // ----------------------------------------------------
    console.log("\n[Test 5] Testing search queries across fields & full name...");

    // Test first-name search
    const firstNameResults = await prisma.person.findMany({
      where: {
        AND: [{ firstName: { contains: "Alice", mode: "insensitive" } }],
      },
    });
    assert(
      firstNameResults.some((p) => p.id === newPerson.id),
      "Test 5: Search by first name ('Alice') succeeds"
    );

    // Test last-name search
    const lastNameResults = await prisma.person.findMany({
      where: {
        AND: [{ lastName: { contains: "Wonderland", mode: "insensitive" } }],
      },
    });
    assert(
      lastNameResults.some((p) => p.id === newPerson.id),
      "Test 5: Search by last name ('Wonderland') succeeds"
    );

    // Test full-name whitespace search ("Alice Wonderland")
    const searchTerms = "Alice Wonderland".split(/\s+/).filter(Boolean);
    const fullNameResults = await prisma.person.findMany({
      where: {
        AND: searchTerms.map((term) => ({
          OR: [
            { personCode: { contains: term, mode: "insensitive" } },
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
            { phone: { contains: term, mode: "insensitive" } },
            { department: { contains: term, mode: "insensitive" } },
          ],
        })),
      },
    });

    assert(
      fullNameResults.some((p) => p.id === newPerson.id),
      "Test 5: Full-name multi-word search ('Alice Wonderland') succeeds"
    );

    // ----------------------------------------------------
    // Test 6: Person Deletion & Cascading Biometric Cleanup
    // ----------------------------------------------------
    console.log("\n[Test 6] Testing person deletion & ImageKit asset cleanup...");
    const deleteTargetFileId = updatedPerson?.faceImageFileId;

    await prisma.$transaction([
      prisma.accessLog.updateMany({ where: { personId: newPerson.id }, data: { personId: null } }),
      prisma.alert.updateMany({ where: { personId: newPerson.id }, data: { personId: null } }),
      prisma.faceEmbedding.deleteMany({ where: { personId: newPerson.id } }),
      prisma.person.delete({ where: { id: newPerson.id } }),
    ]);

    if (deleteTargetFileId) {
      await deleteFaceImage(deleteTargetFileId);
    }

    const deletedCheck = await prisma.person.findUnique({ where: { id: newPerson.id } });
    const deletedEmbs = await prisma.faceEmbedding.findMany({ where: { personId: newPerson.id } });

    assert(deletedCheck === null, "Test 6: Person record deleted from PostgreSQL");
    assert(deletedEmbs.length === 0, "Test 6: FaceEmbedding records cascaded and deleted from PostgreSQL");

    createdPersonId = null;
    createdFileId = null;
  } catch (err: any) {
    console.error("❌ Test suite encountered error:", err);
    process.exitCode = 1;
  } finally {
    // Cleanup if test aborted mid-way
    if (createdPersonId) {
      await prisma.faceEmbedding.deleteMany({ where: { personId: createdPersonId } }).catch(() => {});
      await prisma.person.delete({ where: { id: createdPersonId } }).catch(() => {});
    }
    if (createdFileId) {
      await deleteFaceImage(createdFileId).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log("\n==================================================");
  console.log(`  Passed: ${testsPassed} | Failed: ${testsFailed}`);
  if (testsFailed > 0) {
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
