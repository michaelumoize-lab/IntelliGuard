import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { generateEmbedding } from "../lib/ai/fastapi";
import { findTopFaceMatches } from "../lib/ai/face-recognition";
import { evaluateAccess } from "../lib/access/access-control";

async function runMilestone7IntegrationTests() {
  console.log("==================================================");
  console.log("  Milestone 7: Access Control Integration Tests");
  console.log("==================================================\n");

  const singleFacePath = path.join(__dirname, "../../backend/tests/single_face.jpg");

  if (!fs.existsSync(singleFacePath)) {
    console.error("❌ Test image single_face.jpg not found at:", singleFacePath);
    process.exit(1);
  }

  // 1. Test Known Active Person Access Pipeline
  console.log("[Test 1] Testing Known Active Person Access Pipeline...");
  try {
    const singleBuf = fs.readFileSync(singleFacePath);
    const aiResult = await generateEmbedding(singleBuf, "single_face.jpg");
    const recognition = await findTopFaceMatches(aiResult.embedding);

    const decision = evaluateAccess({
      matchStatus: recognition.matchStatus,
      person: recognition.person,
      similarity: recognition.face.similarity,
      distance: recognition.face.distance,
    });

    console.log(` - Match Status: ${recognition.matchStatus}`);
    console.log(` - Access Status: ${decision.accessStatus} | Reason: ${decision.reason} | Door Action: ${decision.doorAction}`);

    if (decision.accessStatus === "granted" && decision.doorAction === "unlock") {
      console.log("✅ Test 1 PASSED: Access GRANTED & UNLOCK decision for registered active person!");
    } else {
      console.error(`❌ Test 1 FAILED: Expected GRANTED & UNLOCK but got accessStatus=${decision.accessStatus}, doorAction=${decision.doorAction}`);
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error("❌ Test 1 failed:", err);
    process.exitCode = 1;
  }

  // 2. Test AccessLog Creation Verification
  console.log("\n[Test 2] Verifying AccessLog Persistence in PostgreSQL...");
  let createdLogId: number | null = null;
  try {
    const initialLogCount = await prisma.accessLog.count();
    const newLog = await prisma.accessLog.create({
      data: {
        matchStatus: "matched",
        accessStatus: "granted",
        reason: "face_match",
        doorAction: "unlock",
        confidenceScore: 0.95,
        embeddingDistance: 0.05,
        processingTimeMs: 1200,
      },
    });
    createdLogId = newLog.id;

    const updatedLogCount = await prisma.accessLog.count();
    if (updatedLogCount === initialLogCount + 1 && newLog.id) {
      console.log(`✅ Test 2 PASSED: AccessLog record #${newLog.id} persisted to PostgreSQL successfully!`);
    } else {
      console.error("❌ Test 2 failed: AccessLog count mismatch.");
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error("❌ Test 2 failed:", err);
    process.exitCode = 1;
  } finally {
    if (createdLogId) {
      await prisma.accessLog.delete({ where: { id: createdLogId } }).catch(() => {});
    }
  }

  // 3. Test Security Alert Creation Verification
  console.log("\n[Test 3] Verifying Security Alert Creation in PostgreSQL...");
  let createdAlertId: number | null = null;
  try {
    const initialAlertCount = await prisma.alert.count();
    const newAlert = await prisma.alert.create({
      data: {
        alertType: "unknown_face",
        title: "Unknown Face Detected",
        message: "An unrecognized face attempted access.",
        severity: "medium",
      },
    });
    createdAlertId = newAlert.id;

    const updatedAlertCount = await prisma.alert.count();
    if (updatedAlertCount === initialAlertCount + 1 && newAlert.id) {
      console.log(`✅ Test 3 PASSED: Security Alert #${newAlert.id} persisted to PostgreSQL successfully!`);
    } else {
      console.error("❌ Test 3 failed: Alert count mismatch.");
      process.exitCode = 1;
    }
  } catch (err: any) {
    console.error("❌ Test 3 failed:", err);
    process.exitCode = 1;
  } finally {
    if (createdAlertId) {
      await prisma.alert.delete({ where: { id: createdAlertId } }).catch(() => {});
    }
  }

  // 4. Test Zero Raw 512D Vector Leakage
  console.log("\n[Test 4] Verifying Zero Raw Vector Leakage...");
  try {
    const singleBuf = fs.readFileSync(singleFacePath);
    const aiResult = await generateEmbedding(singleBuf, "single_face.jpg");
    const recognition = await findTopFaceMatches(aiResult.embedding);
    const decision = evaluateAccess({
      matchStatus: recognition.matchStatus,
      person: recognition.person,
      similarity: recognition.face.similarity,
      distance: recognition.face.distance,
    });

    const responsePayload = {
      success: true,
      access_status: decision.accessStatus,
      reason: decision.reason,
      door_action: decision.doorAction,
      match_status: recognition.matchStatus,
      person: recognition.person,
      face: {
        similarity: recognition.face.similarity,
        distance: recognition.face.distance,
      },
    };

    const hasEmbeddingProp = (obj: any): boolean => {
      if (!obj || typeof obj !== "object") return false;
      if ("embedding" in obj) return true;
      return Object.values(obj).some((v) => hasEmbeddingProp(v));
    };

    if (hasEmbeddingProp(responsePayload)) {
      console.error("❌ Test 4 failed: Raw embedding property exposed!");
      process.exitCode = 1;
    } else {
      console.log("✅ Test 4 PASSED: Zero raw 512D vector floats exposed in response payload.");
    }
  } catch (err: any) {
    console.error("❌ Test 4 failed:", err);
    process.exitCode = 1;
  }

  console.log("\n==================================================");
  if (process.exitCode === 1) {
    console.error("  Milestone 7 Integration Tests Failed!");
  } else {
    console.log("  Milestone 7 Integration Tests Completed Successfully!");
  }
  console.log("==================================================");
}

runMilestone7IntegrationTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exitCode = 1;
});
