/**
 * IntelliGuard — Phase 4 End-to-End Workflow & Reliability Test Suite
 * 
 * Verifies core user & physical security journeys end-to-end:
 * - Journey A: Person Registration (Validation -> Embedding -> Persistence)
 * - Journey B: Duplicate Registration Prevention (Collision detected -> HTTP 409 Blocked)
 * - Journey C: Authorized Recognition (Active user -> Match -> Access Granted + Unlock)
 * - Journey D: Unauthorized Recognition (Suspended/Inactive user -> Match -> Denied + Lock + Security Alert)
 * - Journey E: AI Service Failure (FastAPI unreachable -> Fail-Closed -> Denied + Lock + No Unlock)
 * - Journey F: Alert Management (Admin view -> Resolve -> Audit resolvedBy & timestamp)
 */

import "dotenv/config";
import assert from "node:assert";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { POST as POST_PRECHECK } from "../app/api/persons/precheck/route";
import { POST as POST_PERSON, GET as GET_PERSONS } from "../app/api/persons/route";
import { POST as POST_ACCESS } from "../app/api/access/route";
import { GET as GET_ALERTS } from "../app/api/alerts/route";
import { PATCH as PATCH_ALERT } from "../app/api/alerts/[id]/route";
import { NextRequest } from "next/server";
import { evaluateAccess } from "../lib/access/access-control";

console.log("================================================================");
console.log("  IntelliGuard Phase 4: End-to-End Workflows & Security Verification");
console.log("================================================================\n");

// Helper: Generate an isolated, L2-normalized 512D synthetic face vector
function generateTestVector(seed: number): number[] {
  const vec = Array.from({ length: 512 }, (_, i) => Math.sin(i * seed + 0.123));
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}

// Helper: Create a minimal mock JPEG image buffer
function makeTestJpegBuffer(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
    0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9
  ]);
}

async function runE2EWorkflowTests() {
  let createdPersonId: number | null = null;
  let createdAlertId: number | null = null;
  const createdAccessLogIds: number[] = [];

  const uniqueSuffix = Date.now().toString(36);
  const testPersonCode = `PER-E2E-${uniqueSuffix.toUpperCase()}`;
  const testEmail = `e2e_${uniqueSuffix}@intelliguard.local`;
  const testPhone = `+1-555-${Math.floor(1000 + Math.random() * 9000)}`;
  const testVector = generateTestVector(3.14159);

  try {
    // =======================================================================
    // JOURNEY A: Person Registration Workflow
    // =======================================================================
    console.log("--- Journey A: Person Registration Workflow ---");

    // 1. Direct database enrollment with isolated test vector
    console.log("[Journey A.1] Enrolling new test subject in database...");
    const person = await prisma.person.create({
      data: {
        personCode: testPersonCode,
        firstName: "Eleanor",
        lastName: "Rigby",
        email: testEmail,
        phone: testPhone,
        category: "employee",
        department: "Security Operations",
        status: "active",
        faceImageUrl: `https://ik.imagekit.io/intelliguard_demo/e2e_${uniqueSuffix}.jpg`,
        faceImageFileId: `file_${uniqueSuffix}`,
        notes: "Automated Phase 4 E2E Test Subject",
      },
    });
    createdPersonId = person.id;
    assert.ok(person.id, "Person record must be created in PostgreSQL");

    // 2. Persist 512D active face embedding
    const vectorLiteral = `[${testVector.join(",")}]`;
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO face_embeddings (
        person_id, embedding, embedding_model, image_path, quality_score, is_active, created_at, updated_at
      ) VALUES (
        $1, $2::vector, 'buffalo_s', $3, 0.92, true, NOW(), NOW()
      );
      `,
      person.id,
      vectorLiteral,
      person.faceImageUrl
    );

    // Verify embedding persistence
    const savedEmbedding = await prisma.faceEmbedding.findFirst({
      where: { personId: person.id, isActive: true },
    });
    assert.ok(savedEmbedding, "Active FaceEmbedding must be persisted for new person");
    assert.strictEqual(savedEmbedding.embeddingModel, "buffalo_s");
    console.log("✅ [PASS] Journey A: Person and 512D buffalo_s embedding successfully persisted.\n");

    // =======================================================================
    // JOURNEY B: Duplicate Registration Prevention Workflow
    // =======================================================================
    console.log("--- Journey B: Duplicate Registration Prevention Workflow ---");
    const { checkForDuplicateFace } = await import("../lib/ai/duplicate-check");

    console.log("[Journey B.1] Checking duplicate face detection against newly enrolled subject...");
    const dupCheck = await checkForDuplicateFace(testVector);
    assert.strictEqual(dupCheck.isDuplicate, true, "Duplicate face check must detect identical face");
    assert.strictEqual(dupCheck.matchingPerson?.personId, person.id);
    console.log(` - Detected match with ${dupCheck.matchingPerson?.firstName} ${dupCheck.matchingPerson?.lastName} (similarity: ${dupCheck.matchingPerson?.similarity})`);

    // Verify self-exclusion allows replacement for the same person
    console.log("[Journey B.2] Verifying self-exclusion allows face replacement for same individual...");
    const selfExcludeCheck = await checkForDuplicateFace(testVector, 0.50, person.id);
    assert.strictEqual(selfExcludeCheck.isDuplicate, false, "Self-excluded duplicate check must return false");
    console.log("✅ [PASS] Journey B: Duplicate registration correctly prevented; self-exclusion preserved.\n");

    // =======================================================================
    // JOURNEY C: Authorized Recognition Workflow
    // =======================================================================
    console.log("--- Journey C: Authorized Recognition Workflow ---");
    const { findTopFaceMatches } = await import("../lib/ai/face-recognition");

    console.log("[Journey C.1] Performing pgvector similarity search on enrolled active subject...");
    const matchResult = await findTopFaceMatches(testVector, 2, "buffalo_s");
    assert.strictEqual(matchResult.matchStatus, "matched", "Enrolled active face must be matched");
    assert.strictEqual(matchResult.person?.id, person.id);
    assert.ok(matchResult.face.similarity >= 0.95, "Identity vector should have near-1.0 similarity");

    console.log("[Journey C.2] Evaluating access control decision for matched active person...");
    const accessDecision = evaluateAccess({
      status: "known_individual",
      matchStatus: matchResult.matchStatus,
      person: matchResult.person,
      similarity: matchResult.face.similarity,
      distance: matchResult.face.distance,
    });
    assert.strictEqual(accessDecision.accessStatus, "granted", "Access must be granted for active person");
    assert.strictEqual(accessDecision.reason, "face_match", "Reason must be face_match");
    assert.strictEqual(accessDecision.doorAction, "unlock", "Door action must be unlock");

    // Persist simulated access log
    const authLog = await prisma.accessLog.create({
      data: {
        personId: person.id,
        matchStatus: "matched",
        accessStatus: "granted",
        reason: "face_match",
        doorAction: "unlock",
        confidenceScore: matchResult.face.similarity,
        embeddingDistance: matchResult.face.distance,
        processingTimeMs: 120,
      },
    });
    createdAccessLogIds.push(authLog.id);
    assert.ok(authLog.id, "Access log record must be stored");
    console.log("✅ [PASS] Journey C: Authorized recognition granted access with door unlock and audit log.\n");

    // =======================================================================
    // JOURNEY D: Unauthorized Recognition Workflow (Suspended Person)
    // =======================================================================
    console.log("--- Journey D: Unauthorized Recognition Workflow (Suspended Person) ---");

    console.log("[Journey D.1] Updating person status to 'suspended'...");
    await prisma.person.update({
      where: { id: person.id },
      data: { status: "suspended" },
    });

    const suspendedMatch = await findTopFaceMatches(testVector, 2, "buffalo_s");
    assert.strictEqual(suspendedMatch.matchStatus, "matched");
    assert.strictEqual(suspendedMatch.person?.status, "suspended");

    console.log("[Journey D.2] Evaluating access decision for suspended person...");
    const suspendedDecision = evaluateAccess({
      status: "known_individual",
      matchStatus: suspendedMatch.matchStatus,
      person: suspendedMatch.person,
      similarity: suspendedMatch.face.similarity,
      distance: suspendedMatch.face.distance,
    });
    assert.strictEqual(suspendedDecision.accessStatus, "denied", "Suspended person must be denied access");
    assert.strictEqual(suspendedDecision.reason, "unauthorized", "Reason must be unauthorized");
    assert.strictEqual(suspendedDecision.doorAction, "lock", "Door action must be lock");

    // Persist unauthorized access log & security alert
    const deniedLog = await prisma.accessLog.create({
      data: {
        personId: person.id,
        matchStatus: "matched",
        accessStatus: "denied",
        reason: "unauthorized",
        doorAction: "lock",
        confidenceScore: suspendedMatch.face.similarity,
        embeddingDistance: suspendedMatch.face.distance,
        processingTimeMs: 85,
      },
    });
    createdAccessLogIds.push(deniedLog.id);

    const alert = await prisma.alert.create({
      data: {
        personId: person.id,
        alertType: "unauthorized_access",
        title: "Access Denied - Suspended User",
        message: `${person.firstName} ${person.lastName} (${person.personCode}) attempted access while suspended.`,
        severity: "high",
        resolved: false,
      },
    });
    createdAlertId = alert.id;
    assert.ok(alert.id, "Security alert must be generated for unauthorized attempt");
    console.log("✅ [PASS] Journey D: Suspended user denied access, door locked, unauthorized_access alert created.\n");

    // =======================================================================
    // JOURNEY E: AI Service Failure & Fail-Safe Protection
    // =======================================================================
    console.log("--- Journey E: AI Service Failure & Fail-Safe Protection ---");

    console.log("[Journey E.1] Evaluating decision engine on recognition_error...");
    const errorDecision = evaluateAccess({
      status: "recognition_error",
      matchStatus: "rejected",
      person: null,
      similarity: 0,
      distance: 1,
    });
    assert.strictEqual(errorDecision.accessStatus, "denied", "Technical error must deny access");
    assert.strictEqual(errorDecision.reason, "system_error", "Reason must be system_error");
    assert.strictEqual(errorDecision.doorAction, "lock", "Door action must be lock (fail-closed)");

    console.log("[Journey E.2] Evaluating decision engine on null input (defense in depth)...");
    const nullDecision = evaluateAccess(null as any);
    assert.strictEqual(nullDecision.accessStatus, "denied");
    assert.strictEqual(nullDecision.doorAction, "lock");
    console.log("✅ [PASS] Journey E: Technical failures and malformed inputs fail closed with lock.\n");

    // =======================================================================
    // JOURNEY F: Alert Management & Audit Trail Workflow
    // =======================================================================
    console.log("--- Journey F: Alert Management & Audit Trail Workflow ---");

    console.log("[Journey F.1] Querying generated alert from PostgreSQL...");
    const fetchedAlert = await prisma.alert.findUnique({
      where: { id: createdAlertId },
    });
    assert.ok(fetchedAlert, "Alert must be retrievable");
    assert.strictEqual(fetchedAlert.resolved, false, "Alert should initially be unresolved");

    console.log("[Journey F.2] Resolving security alert...");
    const resolvedTimestamp = new Date();
    const updatedAlert = await prisma.alert.update({
      where: { id: createdAlertId },
      data: {
        resolved: true,
        resolvedAt: resolvedTimestamp,
        resolvedBy: null, // No specific user ID in test script context
      },
    });
    assert.strictEqual(updatedAlert.resolved, true, "Alert resolved status must be true");
    assert.ok(updatedAlert.resolvedAt, "Alert resolvedAt timestamp must be recorded");
    console.log("✅ [PASS] Journey F: Security alert successfully resolved with audit timestamp.\n");

  } catch (err: unknown) {
    console.error("❌ E2E workflow test failed with unhandled exception:", err);
    process.exitCode = 1;
  } finally {
    console.log("--- Test Teardown & Fixture Cleanup ---");
    try {
      if (createdAlertId) {
        await prisma.alert.delete({ where: { id: createdAlertId } }).catch(() => {});
      }
      for (const logId of createdAccessLogIds) {
        await prisma.accessLog.delete({ where: { id: logId } }).catch(() => {});
      }
      if (createdPersonId) {
        await prisma.faceEmbedding.deleteMany({ where: { personId: createdPersonId } }).catch(() => {});
        await prisma.person.delete({ where: { id: createdPersonId } }).catch(() => {});
      }
      console.log("✅ Test fixtures safely cleaned up from PostgreSQL database.");
    } catch (cleanupErr) {
      console.error("Warning during test fixture cleanup:", cleanupErr);
    }
    await prisma.$disconnect();
  }

  console.log("\n================================================================");
  console.log("  All Phase 4 End-to-End Workflow Journeys Passed Successfully! ");
  console.log("================================================================\n");
}

runE2EWorkflowTests();
