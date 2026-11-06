import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  generatePersonCode,
  generateDeviceCode,
  generateEmbeddingCode,
  generateAccessCode,
  generateAlertCode,
  isValidPersonCode,
  isValidDeviceCode,
  isValidEmbeddingCode,
  isValidAccessCode,
  isValidAlertCode,
} from "../lib/identifiers";

/**
 * Business-Code Primary & Foreign Key Architecture Test Suite (Option A)
 *
 * Verifies:
 * 1. 6-digit numeric business code format & cryptographic generation
 * 2. Person creation with personCode as primary key
 * 3. Device creation with deviceCode as primary key
 * 4. FaceEmbedding creation & FK relation (personCode -> Person.personCode)
 * 5. AccessLog creation & FK resolution (accessCode, deviceCode, personCode, embeddingCode)
 * 6. Nullable relationship preservation (personCode: null on unknown face AccessLog)
 * 7. Alert creation & FK resolution (alertCode, deviceCode, personCode)
 * 8. Primary key uniqueness constraint enforcement on business codes
 * 9. Foreign key constraint enforcement on invalid business codes
 */

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
  console.log(`✅ [PASS] ${testName}`);
}

async function runBusinessCodeArchitectureTests() {
  console.log("==========================================================");
  console.log("  Business-Code Primary & Foreign Key Architecture Tests  ");
  console.log("==========================================================\n");

  let createdPersonCode: string | null = null;
  let createdDeviceCode: string | null = null;
  let createdEmbeddingCode: string | null = null;
  let createdAccessCode: string | null = null;
  let createdAlertCode: string | null = null;

  try {
    // ----------------------------------------------------
    // Test 1: 6-Digit Business Code Format Validation
    // ----------------------------------------------------
    console.log("[Test 1] Testing 6-Digit Business Code Format & Validators...");
    const samplePer = generatePersonCode();
    const sampleDev = generateDeviceCode();
    const sampleEmb = generateEmbeddingCode();
    const sampleAsl = generateAccessCode();
    const sampleAlt = generateAlertCode();

    assert(isValidPersonCode(samplePer), `Person code matches ^PER-[0-9]{6}$ (${samplePer})`);
    assert(isValidDeviceCode(sampleDev), `Device code matches ^DEV-[0-9]{6}$ (${sampleDev})`);
    assert(isValidEmbeddingCode(sampleEmb), `Embedding code matches ^EMB-[0-9]{6}$ (${sampleEmb})`);
    assert(isValidAccessCode(sampleAsl), `AccessLog code matches ^ASL-[0-9]{6}$ (${sampleAsl})`);
    assert(isValidAlertCode(sampleAlt), `Alert code matches ^ALT-[0-9]{6}$ (${sampleAlt})`);

    // ----------------------------------------------------
    // Test 2: Person Creation with personCode Primary Key
    // ----------------------------------------------------
    console.log("\n[Test 2] Testing Person creation with personCode as Primary Key...");
    const personCode = generatePersonCode();
    const createdPerson = await prisma.person.create({
      data: {
        personCode,
        firstName: "Arch",
        lastName: "Verification",
        email: `arch_${Date.now()}@example.com`,
        phone: `+1-555-${Math.floor(100000 + Math.random() * 900000)}`,
        category: "employee",
        status: "active",
      },
    });
    createdPersonCode = createdPerson.personCode;

    assert(createdPerson.personCode === personCode, `Person created with PK personCode: ${createdPerson.personCode}`);
    assert(isValidPersonCode(createdPerson.personCode), "Person PK is a valid 6-digit PER-XXXXXX code");
    assert(!("uuidId" in createdPerson) && !("id" in createdPerson), "Redundant id and uuidId fields removed from Person");

    // ----------------------------------------------------
    // Test 3: Device Creation with deviceCode Primary Key
    // ----------------------------------------------------
    console.log("\n[Test 3] Testing Device creation with deviceCode as Primary Key...");
    const deviceCode = generateDeviceCode();
    const createdDevice = await prisma.device.create({
      data: {
        deviceCode,
        deviceName: "Option A Security Cam",
        serialNumber: `SN-OA-${Date.now()}`,
        apiKeyHash: `hash_oa_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        location: "Lab Corridor North",
        deviceType: "camera",
        status: "online",
      },
    });
    createdDeviceCode = createdDevice.deviceCode;

    assert(createdDevice.deviceCode === deviceCode, `Device created with PK deviceCode: ${createdDevice.deviceCode}`);
    assert(isValidDeviceCode(createdDevice.deviceCode), "Device PK is a valid 6-digit DEV-XXXXXX code");

    // ----------------------------------------------------
    // Test 4: FaceEmbedding Creation & FK Relation
    // ----------------------------------------------------
    console.log("\n[Test 4] Testing FaceEmbedding creation with embeddingCode PK & personCode FK...");
    const embeddingCode = generateEmbeddingCode();
    const vectorLiteral = `[${new Array(512).fill(0.044).join(",")}]`;
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO face_embeddings (
        embedding_code, person_code, embedding, embedding_model, image_path, quality_score, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3::vector, 'buffalo_s', 'https://ik.imagekit.io/test/arch_face.jpg', 0.94, true, NOW(), NOW()
      );
      `,
      embeddingCode,
      createdPerson.personCode,
      vectorLiteral
    );
    const createdEmbedding = await prisma.faceEmbedding.findUnique({
      where: { embeddingCode },
    });
    createdEmbeddingCode = createdEmbedding?.embeddingCode ?? null;

    assert(
      Boolean(createdEmbedding) &&
        createdEmbedding!.embeddingCode === embeddingCode &&
        isValidEmbeddingCode(createdEmbedding!.embeddingCode),
      `FaceEmbedding created with PK embeddingCode: ${createdEmbedding?.embeddingCode}`
    );
    assert(
      createdEmbedding!.personCode === createdPerson.personCode,
      "FaceEmbedding.personCode FK references Person.personCode"
    );

    // ----------------------------------------------------
    // Test 5: AccessLog Business-Code Foreign Keys & Resolution
    // ----------------------------------------------------
    console.log("\n[Test 5] Testing AccessLog Business-Code Foreign-Key Population & Resolution...");
    const accessCode = generateAccessCode();
    const createdLog = await prisma.accessLog.create({
      data: {
        accessCode,
        deviceCode: createdDevice.deviceCode,
        personCode: createdPerson.personCode,
        embeddingCode: createdEmbedding!.embeddingCode,
        matchStatus: "matched",
        accessStatus: "granted",
        reason: "face_match",
        doorAction: "unlock",
      },
    });
    createdAccessCode = createdLog.accessCode;

    const fetchedLog = await prisma.accessLog.findUnique({
      where: { accessCode: createdLog.accessCode },
      include: {
        person: true,
        device: true,
        faceEmbedding: true,
      },
    });

    assert(Boolean(fetchedLog), "AccessLog retrieved by accessCode PK successfully");
    assert(isValidAccessCode(fetchedLog!.accessCode), `AccessLog has valid ASL-XXXXXX code (${fetchedLog!.accessCode})`);
    assert(fetchedLog!.deviceCode === createdDevice.deviceCode, "AccessLog.deviceCode matches Device.deviceCode");
    assert(fetchedLog!.personCode === createdPerson.personCode, "AccessLog.personCode matches Person.personCode");
    assert(
      fetchedLog!.embeddingCode === createdEmbedding!.embeddingCode,
      "AccessLog.embeddingCode matches FaceEmbedding.embeddingCode"
    );
    assert(fetchedLog!.device?.deviceCode === createdDevice.deviceCode, "Relation `device` resolves accurately");
    assert(fetchedLog!.person?.personCode === createdPerson.personCode, "Relation `person` resolves accurately");
    assert(
      fetchedLog!.faceEmbedding?.embeddingCode === createdEmbedding!.embeddingCode,
      "Relation `faceEmbedding` resolves accurately"
    );

    // ----------------------------------------------------
    // Test 6: Nullable Foreign Key Preservation
    // ----------------------------------------------------
    console.log("\n[Test 6] Testing Nullable Foreign Key Preservation (Unknown Person)...");
    const anonymousLogCode = generateAccessCode();
    const anonymousLog = await prisma.accessLog.create({
      data: {
        accessCode: anonymousLogCode,
        deviceCode: createdDevice.deviceCode,
        personCode: null,
        embeddingCode: null,
        matchStatus: "unknown",
        accessStatus: "denied",
        reason: "face_no_match",
        doorAction: "lock",
      },
    });

    assert(anonymousLog.personCode === null, "Nullable personCode is preserved as null");
    assert(anonymousLog.deviceCode === createdDevice.deviceCode, "deviceCode remains populated");

    await prisma.accessLog.delete({ where: { accessCode: anonymousLog.accessCode } });

    // ----------------------------------------------------
    // Test 7: Alert Relations & Constraints
    // ----------------------------------------------------
    console.log("\n[Test 7] Testing Alert Business-Code Primary & Foreign Keys...");
    const alertCode = generateAlertCode();
    const createdAlert = await prisma.alert.create({
      data: {
        alertCode,
        deviceCode: createdDevice.deviceCode,
        personCode: createdPerson.personCode,
        alertType: "unauthorized_access",
        title: "Option A Security Alert",
        message: "Business-code key verification alert",
        severity: "medium",
      },
    });
    createdAlertCode = createdAlert.alertCode;

    const fetchedAlert = await prisma.alert.findUnique({
      where: { alertCode: createdAlert.alertCode },
      include: {
        device: true,
        person: true,
      },
    });

    assert(Boolean(fetchedAlert), "Alert retrieved by alertCode PK successfully");
    assert(isValidAlertCode(fetchedAlert!.alertCode), `Alert has valid ALT-XXXXXX code (${fetchedAlert!.alertCode})`);
    assert(fetchedAlert!.deviceCode === createdDevice.deviceCode, "Alert.deviceCode matches Device.deviceCode");
    assert(fetchedAlert!.personCode === createdPerson.personCode, "Alert.personCode matches Person.personCode");
    assert(fetchedAlert!.device?.deviceCode === createdDevice.deviceCode, "Alert relation `device` resolves accurately");
    assert(fetchedAlert!.person?.personCode === createdPerson.personCode, "Alert relation `person` resolves accurately");

    // ----------------------------------------------------
    // Test 8: Primary Key Uniqueness Constraint Rejection
    // ----------------------------------------------------
    console.log("\n[Test 8] Testing Database Primary Key Uniqueness Constraint on deviceCode...");
    let duplicateRejected = false;
    try {
      await prisma.device.create({
        data: {
          deviceCode: createdDevice.deviceCode, // Duplicate PK!
          deviceName: "Duplicate Device",
          serialNumber: `SN-DUP-${Date.now()}`,
          apiKeyHash: `hash_dup_${Date.now()}`,
          location: "Security Desk",
        },
      });
    } catch {
      duplicateRejected = true;
    }
    assert(duplicateRejected, "Database rejects duplicate deviceCode with primary key constraint violation");

    // ----------------------------------------------------
    // Test 9: Foreign Key Constraint Rejection on Invalid Business Code
    // ----------------------------------------------------
    console.log("\n[Test 9] Testing Database Foreign Key Constraint on nonexistent deviceCode...");
    let invalidFkRejected = false;
    try {
      await prisma.alert.create({
        data: {
          alertCode: generateAlertCode(),
          deviceCode: "DEV-000000", // Non-existent device code!
          alertType: "system_error",
          title: "Invalid FK Alert",
          message: "Should be rejected by foreign key constraint",
          severity: "low",
        },
      });
    } catch {
      invalidFkRejected = true;
    }
    assert(invalidFkRejected, "Database rejects nonexistent deviceCode with foreign key violation");

    console.log("\n==========================================================");
    console.log("  All Business-Code Architecture Tests Passed!            ");
    console.log("==========================================================");
  } finally {
    if (createdAlertCode) {
      await prisma.alert.delete({ where: { alertCode: createdAlertCode } }).catch(() => {});
    }
    if (createdAccessCode) {
      await prisma.accessLog.delete({ where: { accessCode: createdAccessCode } }).catch(() => {});
    }
    if (createdEmbeddingCode) {
      await prisma.faceEmbedding.delete({ where: { embeddingCode: createdEmbeddingCode } }).catch(() => {});
    }
    if (createdDeviceCode) {
      await prisma.device.delete({ where: { deviceCode: createdDeviceCode } }).catch(() => {});
    }
    if (createdPersonCode) {
      await prisma.person.delete({ where: { personCode: createdPersonCode } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runBusinessCodeArchitectureTests().catch((err) => {
  console.error("❌ Business-code architecture test suite failed:", err);
  process.exit(1);
});
