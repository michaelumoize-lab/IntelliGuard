import { evaluateAccess } from "../lib/access/access-control";

function runAccessControlUnitTests() {
  console.log("==================================================");
  console.log("  Milestone 7: Decision Engine Unit Tests");
  console.log("==================================================\n");

  const mockPerson = {
    id: 1,
    personCode: "PER-1001",
    firstName: "John",
    lastName: "Doe",
    category: "employee",
    department: "Engineering",
    status: "active",
  };

  // Test 1: Valid Match
  console.log("[Test 1] Valid Matched Active Person...");
  const res1 = evaluateAccess({
    matchStatus: "matched",
    person: mockPerson,
    similarity: 0.91,
    distance: 0.09,
  });
  if (res1.accessStatus === "granted" && res1.reason === "face_match" && res1.doorAction === "unlock") {
    console.log("✅ PASSED: Granted access & unlock for valid matched person.");
  } else {
    console.error("❌ FAILED: Unexpected decision for valid match:", res1);
    process.exitCode = 1;
  }

  // Test 2: Unknown Face
  console.log("\n[Test 2] Unknown Face...");
  const res2 = evaluateAccess({
    matchStatus: "unknown",
    person: null,
    similarity: 0.32,
    distance: 0.68,
  });
  if (res2.accessStatus === "denied" && res2.reason === "face_no_match" && res2.doorAction === "lock") {
    console.log("✅ PASSED: Denied access & lock for unknown face.");
  } else {
    console.error("❌ FAILED: Unexpected decision for unknown face:", res2);
    process.exitCode = 1;
  }

  // Test 3: Ambiguous Recognition
  console.log("\n[Test 3] Ambiguous Recognition...");
  const res3 = evaluateAccess({
    matchStatus: "ambiguous",
    person: null,
    similarity: 0.78,
    distance: 0.22,
  });
  if (res3.accessStatus === "denied" && res3.reason === "insufficient_confidence" && res3.doorAction === "lock") {
    console.log("✅ PASSED: Denied access & lock for ambiguous recognition.");
  } else {
    console.error("❌ FAILED: Unexpected decision for ambiguous match:", res3);
    process.exitCode = 1;
  }

  // Test 4: Inactive Person
  console.log("\n[Test 4] Inactive Person...");
  const res4 = evaluateAccess({
    matchStatus: "matched",
    person: { ...mockPerson, status: "inactive" },
    similarity: 0.95,
    distance: 0.05,
  });
  if (res4.accessStatus === "denied" && res4.doorAction === "lock") {
    console.log("✅ PASSED: Denied access for inactive person.");
  } else {
    console.error("❌ FAILED: Inactive person gained access:", res4);
    process.exitCode = 1;
  }

  // Test 5: Suspended Person
  console.log("\n[Test 5] Suspended Person...");
  const res5 = evaluateAccess({
    matchStatus: "matched",
    person: { ...mockPerson, status: "suspended" },
    similarity: 0.95,
    distance: 0.05,
  });
  if (res5.accessStatus === "denied" && res5.doorAction === "lock") {
    console.log("✅ PASSED: Denied access for suspended person.");
  } else {
    console.error("❌ FAILED: Suspended person gained access:", res5);
    process.exitCode = 1;
  }

  // Test 6: System Failure
  console.log("\n[Test 6] System Failure...");
  const res6 = evaluateAccess({
    matchStatus: "unknown",
    person: null,
    similarity: 0,
    distance: 1,
  });
  if (res6.accessStatus === "denied" && res6.doorAction === "lock") {
    console.log("✅ PASSED: System failure failed closed with lock.");
  } else {
    console.error("❌ FAILED: System failure did not lock:", res6);
    process.exitCode = 1;
  }

  // Test 7: Fail Closed on Invalid Input
  console.log("\n[Test 7] Null Input Fail Closed...");
  const res7 = evaluateAccess(null as unknown as Parameters<typeof evaluateAccess>[0]);
  if (res7.accessStatus === "denied" && res7.doorAction === "lock") {
    console.log("✅ PASSED: Null input safely failed closed.");
  } else {
    console.error("❌ FAILED: Null input did not fail closed:", res7);
    process.exitCode = 1;
  }

  // Test 8: No Person Detected (Hardware Non-Action)
  console.log("\n[Test 8] No Person Detected...");
  const res8 = evaluateAccess({
    status: "no_person",
    similarity: 0,
    distance: 1,
  });
  if (res8.accessStatus === "denied" && res8.reason === "no_person_detected" && res8.doorAction === "no_action") {
    console.log("✅ PASSED: No person detected correctly resulted in non-action door state.");
  } else {
    console.error("❌ FAILED: Unexpected decision for no person detected:", res8);
    process.exitCode = 1;
  }

  // Test 9: Person Detected, No Face Detected (Hardware Non-Action)
  console.log("\n[Test 9] Person Detected, No Face Detected...");
  const res9 = evaluateAccess({
    status: "person_no_face",
    similarity: 0,
    distance: 1,
  });
  if (res9.accessStatus === "denied" && res9.reason === "no_face_detected" && res9.doorAction === "no_action") {
    console.log("✅ PASSED: Person without face correctly resulted in non-action door state.");
  } else {
    console.error("❌ FAILED: Unexpected decision for person without face:", res9);
    process.exitCode = 1;
  }

  // Test 10: Face Detected, Low Quality (Hardware Non-Action)
  console.log("\n[Test 10] Face Detected, Low Quality...");
  const res10 = evaluateAccess({
    status: "face_low_quality",
    similarity: 0,
    distance: 1,
  });
  if (res10.accessStatus === "denied" && res10.reason === "poor_quality_face" && res10.doorAction === "no_action") {
    console.log("✅ PASSED: Low quality face correctly resulted in non-action door state.");
  } else {
    console.error("❌ FAILED: Unexpected decision for low quality face:", res10);
    process.exitCode = 1;
  }

  // Test 11: Presentation Attack (Spoof) Detected -> Lock & Deny
  console.log("\n[Test 11] Presentation Attack (Spoof) Detected...");
  const res11 = evaluateAccess({
    status: "spoof_detected",
    similarity: 0.95, // Even if similarity was high, liveness overrides it
    distance: 0.05,
    person: mockPerson,
  });
  if (res11.accessStatus === "denied" && res11.reason === "spoof_detected" && res11.doorAction === "lock") {
    console.log("✅ PASSED: Spoof detected correctly locked door and denied access regardless of face match.");
  } else {
    console.error("❌ FAILED: Unexpected decision for spoof presentation attack:", res11);
    process.exitCode = 1;
  }

  // Test 12: Liveness Check Inconclusive -> Fail Closed (Lock & Deny)
  console.log("\n[Test 12] Liveness Check Inconclusive...");
  const res12 = evaluateAccess({
    status: "liveness_inconclusive",
    similarity: 0.88,
    distance: 0.12,
    person: mockPerson,
  });
  if (res12.accessStatus === "denied" && res12.reason === "liveness_failed" && res12.doorAction === "lock") {
    console.log("✅ PASSED: Inconclusive liveness correctly failed closed with lock.");
  } else {
    console.error("❌ FAILED: Unexpected decision for inconclusive liveness:", res12);
    process.exitCode = 1;
  }

  console.log("\n==================================================");
  if (process.exitCode === 1) {
    console.error("  Some Decision Engine Unit Tests Failed!");
  } else {
    console.log("  All Decision Engine Unit Tests Passed!");
  }
  console.log("==================================================");
}

runAccessControlUnitTests();
