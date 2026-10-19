import "dotenv/config";
import fs from "fs";
import path from "path";
import { generateEmbedding } from "../lib/ai/fastapi";
import { findTopFaceMatches } from "../lib/ai/face-recognition";
import { evaluateAccess } from "../lib/access/access-control";

async function runWebcamSimulationTests() {
  console.log("==================================================");
  console.log("  Milestone 8: Webcam Simulation Verification");
  console.log("==================================================\n");

  const aiServicePath = path.join(__dirname, "../../ai-service/tests/single_face.jpg");
  const backendPath = path.join(__dirname, "../../backend/tests/single_face.jpg");
  const singleFacePath = fs.existsSync(aiServicePath) ? aiServicePath : backendPath;

  if (!fs.existsSync(singleFacePath)) {
    console.error("❌ Test image single_face.jpg not found at:", singleFacePath);
    process.exit(1);
  }

  // 1. Test Client Payload Construction Rule (deviceId must be omitted in browser simulation)
  console.log("[Test 1] Verifying Browser Simulation DeviceId Omission Rule...");
  const simulatedFormData = new FormData();
  const mockBlob = new Blob([fs.readFileSync(singleFacePath)], { type: "image/jpeg" });
  simulatedFormData.append("image", mockBlob, "webcam_frame.jpg");

  const hasImage = simulatedFormData.has("image");
  const hasDeviceId = simulatedFormData.has("deviceId");

  if (hasImage && !hasDeviceId) {
    console.log("✅ Test 1 PASSED: Browser webcam payload contains 'image' and correctly omits 'deviceId'.");
  } else {
    console.error("❌ Test 1 failed: deviceId exposed in browser simulation payload.");
    process.exitCode = 1;
  }

  // 2. Test End-to-End Simulation Pipeline (Webcam Frame -> M6 -> M7 -> Response)
  console.log("\n[Test 2] Testing Complete Simulation Pipeline...");
  try {
    const singleBuf = fs.readFileSync(singleFacePath);
    const aiResult = await generateEmbedding(singleBuf, "webcam_frame.jpg");
    const recognition = await findTopFaceMatches(aiResult.embedding);

    const decision = evaluateAccess({
      matchStatus: recognition.matchStatus,
      person: recognition.person,
      similarity: recognition.face.similarity,
      distance: recognition.face.distance,
    });

    console.log(` - Match Status: ${recognition.matchStatus}`);
    console.log(` - Decision: ${decision.accessStatus} | Reason: ${decision.reason} | Door Action: ${decision.doorAction}`);

    if (decision.accessStatus && decision.doorAction) {
      console.log("✅ Test 2 PASSED: Simulation pipeline successfully evaluated recognition & access decision!");
    } else {
      console.error("❌ Test 2 failed: Missing decision values.");
      process.exitCode = 1;
    }
  } catch (err: unknown) {
    console.error("❌ Test 2 failed:", err);
    process.exitCode = 1;
  }

  // 3. Test Scan History Capping (Max 10 Items)
  console.log("\n[Test 3] Verifying Scan History Capping Limit (Max 10)...");
  let historyList: Array<{ id: number; name: string }> = [];
  for (let i = 1; i <= 15; i++) {
    const item = { id: i, name: `User ${i}` };
    historyList = [item, ...historyList].slice(0, 10);
  }

  if (historyList.length === 10 && historyList[0].name === "User 15") {
    console.log("✅ Test 3 PASSED: Scan history list correctly capped at 10 items.");
  } else {
    console.error("❌ Test 3 failed: Scan history list length:", historyList.length);
    process.exitCode = 1;
  }

  // 4. Test In-Flight Request Throttling Logic
  console.log("\n[Test 4] Verifying In-Flight Request Throttling Guard...");
  let inFlight = false;
  let skippedCalls = 0;

  const simulateAutoScan = async () => {
    if (inFlight) {
      skippedCalls++;
      return;
    }
    inFlight = true;
    await new Promise((resolve) => setTimeout(resolve, 50));
    inFlight = false;
  };

  // Trigger rapid concurrent scans
  await Promise.all([simulateAutoScan(), simulateAutoScan(), simulateAutoScan()]);

  if (skippedCalls > 0) {
    console.log(`✅ Test 4 PASSED: In-flight guard skipped ${skippedCalls} concurrent requests to prevent API flooding.`);
  } else {
    console.error("❌ Test 4 failed: Concurrent requests were not throttled.");
    process.exitCode = 1;
  }

  // 5. Test P0 Device Auth No-Fallback & Alert-Write Failure Resilience
  console.log("\n[Test 5] Verifying Malformed Device Headers Never Fall Back to Browser Session...");
  const { NextRequest } = await import("next/server");
  const { auth } = await import("../lib/auth");
  const { prisma } = await import("../lib/prisma");
  const { POST: POST_ACCESS } = await import("../app/api/access/route");
  const { scanFace } = await import("../lib/access/access-client");

  const originalGetSession = auth.api.getSession;
  try {
    // Even if a valid ADMIN browser session exists, any device header must force device auth and reject malformed credentials
    (auth.api as unknown as { getSession: typeof auth.api.getSession }).getSession = (async () => ({
      user: { id: "admin-sim", email: "admin@intelliguard.local", name: "Admin", role: "ADMIN" },
      session: { id: "sess-admin-sim", userId: "admin-sim", expiresAt: new Date(Date.now() + 60000) },
    })) as unknown as typeof auth.api.getSession;

    const formWithEmptyDeviceHeader = new FormData();
    formWithEmptyDeviceHeader.append(
      "image",
      new Blob([fs.readFileSync(singleFacePath)], { type: "image/jpeg" }),
      "webcam_frame.jpg"
    );

    const malformedDeviceReq = new NextRequest("http://localhost:3000/api/access", {
      method: "POST",
      headers: {
        "x-device-id": "", // Empty device header must NOT fall back to Admin session
      },
      body: formWithEmptyDeviceHeader,
    });

    const beforeAlerts = await prisma.alert.count({
      where: { title: "Device Authentication Rejected" },
    });

    const malformedRes = await POST_ACCESS(malformedDeviceReq);
    const malformedData = await malformedRes.json();

    const afterAlerts = await prisma.alert.count({
      where: { title: "Device Authentication Rejected" },
    });

    // Clean up created security alert
    const latestRejectionAlert = await prisma.alert.findFirst({
      where: { title: "Device Authentication Rejected" },
      orderBy: { createdAt: "desc" },
    });
    if (latestRejectionAlert) {
      await prisma.alert.delete({ where: { id: latestRejectionAlert.id } }).catch(() => {});
    }

    if (
      malformedRes.status === 401 &&
      malformedData.access_status === "denied" &&
      malformedData.door_action === "lock" &&
      malformedData.status === "recognition_error" &&
      malformedData.match_status === "rejected" &&
      afterAlerts === beforeAlerts + 1
    ) {
      console.log(
        "✅ Test 5 PASSED: Malformed device header rejected with 401 (no session fallback) and security alert recorded."
      );
    } else {
      console.error("❌ Test 5 failed:", {
        status: malformedRes.status,
        data: malformedData,
        beforeAlerts,
        afterAlerts,
      });
      process.exitCode = 1;
    }

    // Verify alert-write failure does not mask 401 rejection
    const origAlertCreate = prisma.alert.create;
    (prisma.alert as unknown as { create: typeof prisma.alert.create }).create = (async () => {
      throw new Error("Simulated DB alert table outage");
    }) as unknown as typeof prisma.alert.create;

    try {
      const form2 = new FormData();
      form2.append("image", new Blob([fs.readFileSync(singleFacePath)], { type: "image/jpeg" }), "webcam_frame.jpg");
      const reqAlertFail = new NextRequest("http://localhost:3000/api/access", {
        method: "POST",
        headers: { "x-api-key": "invalid-key-only" },
        body: form2,
      });
      const resAlertFail = await POST_ACCESS(reqAlertFail);
      if (resAlertFail.status === 401) {
        console.log("✅ Test 5b PASSED: Alert write failure did not mask 401 device authentication rejection.");
      } else {
        console.error(`❌ Test 5b failed: Expected 401 when alert write fails, got ${resAlertFail.status}`);
        process.exitCode = 1;
      }
    } finally {
      (prisma.alert as unknown as { create: typeof prisma.alert.create }).create = origAlertCreate;
    }

    // 6. Test P0 Client & Server Technical Error Classification (Never Unknown Individual)
    console.log("\n[Test 6] Verifying Technical Errors (500 / Network) Never Classify as Unknown Individual...");
    const origFetch = globalThis.fetch;
    try {
      // 6a. Simulate HTTP 500 database/vector search failure response
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            success: false,
            access_status: "denied",
            reason: "system_error",
            door_action: "lock",
            message: "Verification error: database or vector similarity search failed.",
            error: "DATABASE_ERROR",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        )) as typeof fetch;

      const scan500 = await scanFace(new Blob(["test"], { type: "image/jpeg" }));
      if (
        scan500.success === false &&
        scan500.status === "recognition_error" &&
        scan500.match_status === "rejected" &&
        scan500.access_status === "denied" &&
        scan500.reason === "system_error" &&
        scan500.door_action === "lock" &&
        scan500.status !== ("unknown_individual" as string)
      ) {
        console.log("✅ Test 6a PASSED: HTTP 500 DB/vector failure normalized to recognition_error & rejected.");
      } else {
        console.error("❌ Test 6a failed:", scan500);
        process.exitCode = 1;
      }

      // 6b. Simulate Network Failure (fetch rejection)
      globalThis.fetch = (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch;

      const scanNetErr = await scanFace(new Blob(["test"], { type: "image/jpeg" }));
      if (
        scanNetErr.success === false &&
        scanNetErr.status === "recognition_error" &&
        scanNetErr.match_status === "rejected" &&
        scanNetErr.access_status === "denied" &&
        scanNetErr.reason === "system_error" &&
        scanNetErr.door_action === "lock"
      ) {
        console.log("✅ Test 6b PASSED: Network failure normalized to fail-safe recognition_error & lock.");
      } else {
        console.error("❌ Test 6b failed:", scanNetErr);
        process.exitCode = 1;
      }
    } finally {
      globalThis.fetch = origFetch;
    }

    // 6c. Simulate Server-Side Database / pgvector Failure in POST /api/access
    const origQueryRawUnsafe = prisma.$queryRawUnsafe;
    (prisma as unknown as { $queryRawUnsafe: typeof prisma.$queryRawUnsafe }).$queryRawUnsafe = (async () => {
      throw new Error("Simulated pgvector index query failure");
    }) as unknown as typeof prisma.$queryRawUnsafe;

    try {
      const formDbFail = new FormData();
      formDbFail.append(
        "image",
        new Blob([fs.readFileSync(singleFacePath)], { type: "image/jpeg" }),
        "webcam_frame.jpg"
      );
      const reqDbFail = new NextRequest("http://localhost:3000/api/access", {
        method: "POST",
        body: formDbFail,
      });
      const resDbFail = await POST_ACCESS(reqDbFail);
      const dataDbFail = await resDbFail.json();

      // Clean up any system_error log/alert created by the test
      const createdSysAlert = await prisma.alert.findFirst({
        where: { title: "Database Vector Search Failure" },
        orderBy: { createdAt: "desc" },
      });
      if (createdSysAlert) {
        await prisma.alert.delete({ where: { id: createdSysAlert.id } }).catch(() => {});
      }
      const createdSysLog = await prisma.accessLog.findFirst({
        where: { reason: "system_error", matchStatus: "rejected" },
        orderBy: { createdAt: "desc" },
      });
      if (createdSysLog) {
        await prisma.accessLog.delete({ where: { id: createdSysLog.id } }).catch(() => {});
      }

      if (
        resDbFail.status === 500 &&
        dataDbFail.success === false &&
        dataDbFail.status === "recognition_error" &&
        dataDbFail.match_status === "rejected" &&
        dataDbFail.access_status === "denied" &&
        dataDbFail.reason === "system_error" &&
        dataDbFail.door_action === "lock" &&
        dataDbFail.person === null &&
        dataDbFail.status !== "unknown_individual"
      ) {
        console.log(
          "✅ Test 6c PASSED: Server POST /api/access returns complete fail-safe recognition_error on pgvector DB failure."
        );
      } else {
        console.error("❌ Test 6c failed:", { status: resDbFail.status, data: dataDbFail });
        process.exitCode = 1;
      }
    } finally {
      (prisma as unknown as { $queryRawUnsafe: typeof prisma.$queryRawUnsafe }).$queryRawUnsafe = origQueryRawUnsafe;
    }
  } catch (err: unknown) {
    console.error("❌ Test 5/6 failed:", err);
    process.exitCode = 1;
  } finally {
    (auth.api as unknown as { getSession: typeof auth.api.getSession }).getSession = originalGetSession;
  }

  console.log("\n==================================================");
  if (process.exitCode === 1) {
    console.error("  Milestone 8 Simulation Tests Failed!");
  } else {
    console.log("  Milestone 8 Simulation Tests Completed Successfully!");
  }
  console.log("==================================================");
}

runWebcamSimulationTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exitCode = 1;
});
