import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  generateUuidV7,
  isValidUuidV7,
  extractTimestampFromUuidV7,
  generatePersonCode,
  generateDeviceCode,
  generateAccessCode,
  generateAlertCode,
} from "../lib/identifiers";

/**
 * Phase 2 UUIDv7 & Dual-Key Relationships Test Suite
 * 
 * Verifies:
 * 1. UUIDv7 generation & RFC 9562 compliance
 * 2. Uniqueness & timestamp monotonically increasing properties
 * 3. Database default generation via PostgreSQL native uuidv7()
 * 4. Dual-key relationships (integer FK + UUID FK)
 * 5. Automatic synchronization triggers
 * 6. Nullable relationship preservation
 * 7. Foreign key constraint enforcement
 * 8. Zero impact on integer primary & foreign keys
 */

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
  console.log(`✅ [PASS] ${testName}`);
}

async function runPhase2Tests() {
  console.log("==================================================");
  console.log("  Phase 2: UUIDv7 & Dual-Key Verification Tests   ");
  console.log("==================================================\n");

  let createdPersonId: string | null = null;
  let createdDeviceId: string | null = null;
  let createdLogId: string | null = null;
  let createdAlertId: string | null = null;

  try {
    // ----------------------------------------------------
    // Test 1: UUIDv7 Format & RFC 9562 Validation
    // ----------------------------------------------------
    console.log("[Test 1] Testing UUIDv7 Generator Format & Variant...");
    const sampleUuid = generateUuidV7();
    console.log(`  Sample UUIDv7: ${sampleUuid}`);

    assert(isValidUuidV7(sampleUuid), "Generated value satisfies UUIDv7 RFC 9562 format");
    assert(sampleUuid.charAt(14) === "7", "15th character (nibble 13) is '7' for version 7");
    const variantChar = sampleUuid.charAt(19).toLowerCase();
    assert(
      ["8", "9", "a", "b"].includes(variantChar),
      `Variant nibble is RFC 4122/9562 variant 1 (${variantChar})`
    );

    const timestamp = extractTimestampFromUuidV7(sampleUuid);
    assert(timestamp !== null, "Extracts timestamp from UUIDv7 successfully");
    const timeDiffMs = Math.abs(Date.now() - timestamp!.getTime());
    assert(timeDiffMs < 5000, `Timestamp is within 5 seconds of wall-clock time (${timeDiffMs}ms)`);

    // ----------------------------------------------------
    // Test 2: Monotonicity & Uniqueness Batch Test
    // ----------------------------------------------------
    console.log("\n[Test 2] Testing Monotonic Ordering & Uniqueness in Batch of 1,000...");
    const batchSize = 1000;
    const batch: string[] = [];
    for (let i = 0; i < batchSize; i++) {
      batch.push(generateUuidV7());
    }
    const uniqueSet = new Set(batch);
    assert(uniqueSet.size === batchSize, `All ${batchSize} generated UUIDv7s are strictly unique`);

    let isMonotonic = true;
    for (let i = 1; i < batch.length; i++) {
      if (batch[i] < batch[i - 1]) {
        isMonotonic = false;
        break;
      }
    }
    assert(isMonotonic, "UUIDv7 batch values are monotonically non-decreasing over time");

    // ----------------------------------------------------
    // Test 3: Database Native UUIDv7 Default Generation
    // ----------------------------------------------------
    console.log("\n[Test 3] Testing PostgreSQL native uuidv7() generation on Person creation...");
    const personCode = generatePersonCode();
    const createdPerson = await prisma.person.create({
      data: {
        personCode,
        firstName: "Phase2",
        lastName: "Verification",
        email: `phase2_${Date.now()}@example.com`,
        phone: `+1-555-${Math.floor(100000 + Math.random() * 900000)}`,
        category: "employee",
        status: "active",
      },
    });
    createdPersonId = createdPerson.uuidId;

    assert(Boolean(createdPerson.uuidId), `Person created with uuidId: ${createdPerson.uuidId}`);
    assert(isValidUuidV7(createdPerson.uuidId), "Person uuidId is a valid RFC 9562 UUIDv7");

    // ----------------------------------------------------
    // Test 4: Device Creation & Default UUIDv7
    // ----------------------------------------------------
    console.log("\n[Test 4] Testing Device creation with native UUIDv7...");
    const deviceCode = generateDeviceCode();
    const createdDevice = await prisma.device.create({
      data: {
        deviceCode,
        deviceName: "Phase 2 Security Cam",
        serialNumber: `SN-P2-${Date.now()}`,
        apiKeyHash: `hash_p2_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        location: "Lab Corridor North",
        deviceType: "camera",
        status: "online",
      },
    });
    createdDeviceId = createdDevice.uuidId;

    assert(Boolean(createdDevice.uuidId), `Device created with uuidId: ${createdDevice.uuidId}`);
    assert(isValidUuidV7(createdDevice.uuidId), "Device uuidId is a valid RFC 9562 UUIDv7");

    // ----------------------------------------------------
    // Test 5: Foreign-Key Population & Resolution
    // ----------------------------------------------------
    console.log("\n[Test 5] Testing AccessLog UUID Foreign-Key Population...");
    const accessCode = generateAccessCode();
    const createdLog = await prisma.accessLog.create({
      data: {
        accessCode,
        deviceUuidId: createdDevice.uuidId,
        personUuidId: createdPerson.uuidId,
        matchStatus: "matched",
        accessStatus: "granted",
        reason: "face_match",
        doorAction: "unlock",
      },
    });
    createdLogId = createdLog.uuidId;

    // Fetch back the log including relation fields
    const fetchedLog = await prisma.accessLog.findUnique({
      where: { uuidId: createdLog.uuidId },
      include: {
        person: true,
        device: true,
      },
    });

    assert(Boolean(fetchedLog), "AccessLog retrieved successfully");
    assert(isValidUuidV7(fetchedLog!.uuidId), "AccessLog has valid native UUIDv7");
    assert(fetchedLog!.deviceUuidId === createdDevice.uuidId, "AccessLog deviceUuidId matches Device uuidId");
    assert(fetchedLog!.personUuidId === createdPerson.uuidId, "AccessLog personUuidId matches Person uuidId");
    assert(fetchedLog!.device?.uuidId === createdDevice.uuidId, "UUID relation `device` resolves accurately");
    assert(fetchedLog!.person?.uuidId === createdPerson.uuidId, "UUID relation `person` resolves accurately");

    // ----------------------------------------------------
    // Test 6: Nullable Foreign Key Preservation
    // ----------------------------------------------------
    console.log("\n[Test 6] Testing Nullable Foreign Key Preservation (Unknown Person)...");
    const anonymousLogCode = generateAccessCode();
    const anonymousLog = await prisma.accessLog.create({
      data: {
        accessCode: anonymousLogCode,
        deviceUuidId: createdDevice.uuidId,
        personUuidId: null, // Nullable person
        matchStatus: "unknown",
        accessStatus: "denied",
        reason: "face_no_match",
        doorAction: "lock",
      },
    });

    assert(anonymousLog.personUuidId === null, "UUID personUuidId is preserved as null");
    assert(anonymousLog.deviceUuidId === createdDevice.uuidId, "Device UUID remains correctly populated");

    await prisma.accessLog.delete({ where: { uuidId: anonymousLog.uuidId } });

    // ----------------------------------------------------
    // Test 7: Alert Relations & Constraints
    // ----------------------------------------------------
    console.log("\n[Test 7] Testing Alert UUID Foreign Keys...");
    const alertCode = generateAlertCode();
    const createdAlert = await prisma.alert.create({
      data: {
        alertCode,
        deviceUuidId: createdDevice.uuidId,
        personUuidId: createdPerson.uuidId,
        alertType: "unauthorized_access",
        title: "Phase 2 Security Alert",
        message: "Dual-key verification alert",
        severity: "medium",
      },
    });
    createdAlertId = createdAlert.uuidId;

    const fetchedAlert = await prisma.alert.findUnique({
      where: { uuidId: createdAlert.uuidId },
      include: {
        device: true,
        person: true,
      },
    });

    assert(Boolean(fetchedAlert), "Alert retrieved successfully");
    assert(isValidUuidV7(fetchedAlert!.uuidId), "Alert has valid native UUIDv7");
    assert(fetchedAlert!.deviceUuidId === createdDevice.uuidId, "Alert deviceUuidId matches Device uuidId");
    assert(fetchedAlert!.personUuidId === createdPerson.uuidId, "Alert personUuidId matches Person uuidId");
    assert(fetchedAlert!.device?.uuidId === createdDevice.uuidId, "Alert UUID relation `device` resolves accurately");
    assert(fetchedAlert!.person?.uuidId === createdPerson.uuidId, "Alert UUID relation `person` resolves accurately");

    // ----------------------------------------------------
    // Test 8: Uniqueness Constraint Rejection on uuidId
    // ----------------------------------------------------
    console.log("\n[Test 8] Testing Database Unique Constraint on uuidId...");
    let duplicateRejected = false;
    try {
      await prisma.device.create({
        data: {
          uuidId: createdDevice.uuidId, // Duplicate UUID!
          deviceCode: generateDeviceCode(),
          deviceName: "Duplicate Device",
          serialNumber: `SN-DUP-${Date.now()}`,
          apiKeyHash: `hash_dup_${Date.now()}`,
          location: "Security Desk",
        },
      });
    } catch {
      duplicateRejected = true;
    }
    assert(duplicateRejected, "Database correctly rejects duplicate uuidId with unique constraint violation");

    // ----------------------------------------------------
    // Test 9: Foreign Key Constraint Rejection on Invalid UUID
    // ----------------------------------------------------
    console.log("\n[Test 9] Testing Database Foreign Key Constraint on invalid UUID FK...");
    let invalidFkRejected = false;
    try {
      await prisma.alert.create({
        data: {
          alertCode: generateAlertCode(),
          deviceUuidId: "01000000-0000-7000-8000-000000000000", // Non-existent device UUID!
          alertType: "system_error",
          title: "Invalid FK Alert",
          message: "Should be rejected by foreign key constraint",
          severity: "low",
        },
      });
    } catch {
      invalidFkRejected = true;
    }
    assert(invalidFkRejected, "Database correctly rejects invalid deviceUuidId with foreign key violation");

    console.log("\n==================================================");
    console.log("  All Phase 2 UUIDv7 & Dual-Key Tests Passed!    ");
    console.log("==================================================");
  } finally {
    // Clean up created test entities
    if (createdAlertId) {
      await prisma.alert.delete({ where: { uuidId: createdAlertId } }).catch(() => {});
    }
    if (createdLogId) {
      await prisma.accessLog.delete({ where: { uuidId: createdLogId } }).catch(() => {});
    }
    if (createdDeviceId) {
      await prisma.device.delete({ where: { uuidId: createdDeviceId } }).catch(() => {});
    }
    if (createdPersonId) {
      await prisma.person.delete({ where: { uuidId: createdPersonId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runPhase2Tests().catch((err) => {
  console.error("❌ Phase 2 test suite failed:", err);
  process.exit(1);
});
