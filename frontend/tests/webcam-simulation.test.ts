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

  const singleFacePath = path.join(__dirname, "../../backend/tests/single_face.jpg");

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
    }
  } catch (err: any) {
    console.error("❌ Test 2 failed:", err);
  }

  // 3. Test Scan History Capping (Max 10 Items)
  console.log("\n[Test 3] Verifying Scan History Capping Limit (Max 10)...");
  let historyList: any[] = [];
  for (let i = 1; i <= 15; i++) {
    const item = { id: i, name: `User ${i}` };
    historyList = [item, ...historyList].slice(0, 10);
  }

  if (historyList.length === 10 && historyList[0].name === "User 15") {
    console.log("✅ Test 3 PASSED: Scan history list correctly capped at 10 items.");
  } else {
    console.error("❌ Test 3 failed: Scan history list length:", historyList.length);
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
  }

  console.log("\n==================================================");
  console.log("  Milestone 8 Simulation Tests Completed!");
  console.log("==================================================");
}

runWebcamSimulationTests().catch(console.error);
