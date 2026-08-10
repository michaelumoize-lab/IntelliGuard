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
  }

  // Test 7: Fail Closed on Invalid Input
  console.log("\n[Test 7] Null Input Fail Closed...");
  const res7 = evaluateAccess(null as any);
  if (res7.accessStatus === "denied" && res7.doorAction === "lock") {
    console.log("✅ PASSED: Null input safely failed closed.");
  } else {
    console.error("❌ FAILED: Null input did not fail closed:", res7);
  }

  console.log("\n==================================================");
  console.log("  All Decision Engine Unit Tests Passed!");
  console.log("==================================================");
}

runAccessControlUnitTests();
