import "dotenv/config";
import ImageKit from "imagekit";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { auth } from "../lib/auth";
import {
  checkForDuplicateFace,
  validateEmbeddingVector,
  REQUIRED_DUPLICATE_MESSAGE,
  DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD,
} from "../lib/ai/duplicate-check";
import { findTopFaceMatches } from "../lib/ai/face-recognition";
import { POST as POST_PRECHECK } from "../app/api/persons/precheck/route";
import { POST as POST_PERSONS } from "../app/api/persons/route";
import { POST as POST_REPLACE_FACE } from "../app/api/persons/[id]/face/route";
import { POST as POST_ACCESS } from "../app/api/access/route";

/**
 * Generates a deterministic L2-normalized 512D unit vector concentrated on high indices
 * so it is orthogonal to real faces in the database unless explicitly mixed.
 */
function makeUnitVector(primaryAxis: number, secondaryAxis?: number, secondaryWeight = 0): number[] {
  const vec = new Array<number>(512).fill(0);
  const w1 = Math.sqrt(Math.max(0, 1 - secondaryWeight * secondaryWeight));
  vec[primaryAxis] = w1;
  if (secondaryAxis !== undefined) {
    vec[secondaryAxis] = secondaryWeight;
  }
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

function makeDummyImageFile(name = "capture.jpg"): File {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  return new File([bytes], name, { type: "image/jpeg" });
}

async function runPhase2RemediationTests() {
  console.log("==============================================================");
  console.log("  IntelliGuard Phase 2: Recognition, Duplicate & Auth Suite");
  console.log("==============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${label}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
      failed++;
      process.exitCode = 1;
    }
  }

  const createdPersonIds: number[] = [];

  const originalGetSession = auth.api.getSession;
  const originalFetch = global.fetch;
  const originalIkUpload = ImageKit.prototype.upload;
  const originalIkDeleteFile = ImageKit.prototype.deleteFile;

  // Ensure our synthetic vectors on axes 500..511 have ~0 similarity against existing DB embeddings
  const baseVecA = makeUnitVector(500, 501, 0.1);
  const precheckExisting = await checkForDuplicateFace(baseVecA, 0.25);
  const signA = (precheckExisting.matchingPerson?.similarity ?? 0) > 0.1 ? -1 : 1;
  const personAVec = baseVecA.map((v) => v * signA);

  // Another capture of Person A with ~0.58 cosine similarity (above 0.50 buffalo_s threshold, below old 0.85 threshold!)
  const personADifferentCaptureVec = makeUnitVector(500, 502, 0.81).map((v, idx) =>
    idx === 500 ? v * signA : v
  );

  // Distinct Person B vector
  const personBVec = makeUnitVector(505, 506, 0.1);

  // Distinct Person C vector within ambiguity margin of a query on B
  const personCVec = makeUnitVector(505, 507, 0.15);

  // Completely unknown vector (orthogonal to all)
  const unknownVec = makeUnitVector(510, 511, 0.2);

  try {
    // Clean up any stale test records from previously interrupted runs
    await prisma.person.deleteMany({
      where: {
        OR: [
          { personCode: { startsWith: "P2-" } },
          { firstName: { in: ["PhaseTwo", "Concurrent"] } },
        ],
      },
    }).catch(() => {});

    // Mock Admin Session for API route tests
    (auth.api as unknown as { getSession: typeof auth.api.getSession }).getSession = (async () => ({
      user: { id: "admin-phase2-test", email: "admin@intelliguard.local", name: "Phase2 Admin", role: "ADMIN" },
      session: { id: "sess-phase2", userId: "admin-phase2-test", expiresAt: new Date(Date.now() + 3600000) },
    })) as unknown as typeof auth.api.getSession;

    // Mock ImageKit prototype methods so tests don't upload or delete external cloud files
    let mockFileCounter = 1;
    ImageKit.prototype.upload = (async (opts: { fileName?: string }) => {
      const idx = mockFileCounter++;
      const name = opts?.fileName || `face_${idx}.jpg`;
      return {
        url: `https://ik.imagekit.io/test/intelliguard/phase2_${idx}_${name}`,
        fileId: `mock_file_id_${idx}`,
        filePath: `/intelliguard/persons/phase2_${idx}_${name}`,
        name,
      };
    }) as unknown as typeof ImageKit.prototype.upload;

    ImageKit.prototype.deleteFile = (async () => {}) as unknown as typeof ImageKit.prototype.deleteFile;

    let currentMockEmbedding: number[] = personAVec;
    let shouldFailFastApi = false;

    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/api/v1/detect")) {
        if (shouldFailFastApi) {
          return new Response(JSON.stringify({ detail: "Simulated FastAPI unavailability" }), { status: 503 });
        }
        return new Response(
          JSON.stringify({
            success: true,
            face_count: 1,
            faces: [{ bbox: [100, 100, 300, 300], confidence: 0.99 }],
            execution_time_ms: 12,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/v1/embedding")) {
        if (shouldFailFastApi) {
          return new Response(JSON.stringify({ detail: "Simulated FastAPI unavailability" }), { status: 503 });
        }
        return new Response(
          JSON.stringify({
            success: true,
            face_detected: true,
            embedding: currentMockEmbedding,
            embedding_size: currentMockEmbedding.length,
            normalized: true,
            quality_score: 0.92,
            detection_confidence: 0.99,
            model: "buffalo_s",
            execution_time_ms: 25,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/api/v1/analyze")) {
        if (shouldFailFastApi) {
          return new Response(JSON.stringify({ detail: "Simulated FastAPI unavailability" }), { status: 503 });
        }
        return new Response(
          JSON.stringify({
            success: true,
            status: "face_detected_processing",
            person_detected: true,
            face_detected: true,
            person_count: 1,
            face_count: 1,
            persons: [{ bbox: [50, 50, 400, 600], confidence: 0.95, is_primary: true }],
            faces: [{ bbox: [100, 100, 300, 300], confidence: 0.99 }],
            primary_person_bbox: [50, 50, 400, 600],
            primary_face_bbox: [100, 100, 300, 300],
            embedding: currentMockEmbedding,
            embedding_size: currentMockEmbedding.length,
            quality_score: 0.92,
            detection_confidence: 0.99,
            liveness_status: "live",
            liveness_score: 0.98,
            model: "buffalo_s",
            image_width: 640,
            image_height: 480,
            execution_time_ms: 35,
            yolo_time_ms: 10,
            insightface_time_ms: 15,
            liveness_time_ms: 10,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return originalFetch(input, init);
    }) as typeof global.fetch;

    // =========================================================================
    // SECTION A: DUPLICATE REGISTRATION TESTS (10 Tests)
    // =========================================================================
    console.log("--- Section A: Duplicate Registration Prevention ---");

    // 1. Registering a unique face succeeds (Precheck + Final Registration)
    currentMockEmbedding = personAVec;
    const precheckForm1 = new FormData();
    precheckForm1.append("image", makeDummyImageFile("personA.jpg"));
    const precheckReq1 = new NextRequest("http://localhost:3000/api/persons/precheck", {
      method: "POST",
      body: precheckForm1,
    });
    const precheckRes1 = await POST_PRECHECK(precheckReq1);
    const precheckData1 = await precheckRes1.json();

    assert(
      precheckRes1.status === 200 && precheckData1.canProceed === true && precheckData1.isDuplicate === false,
      "1a. Precheck allows unique face registration",
      JSON.stringify(precheckData1)
    );

    const regForm1 = new FormData();
    regForm1.append("firstName", "PhaseTwo");
    regForm1.append("lastName", "Alpha");
    regForm1.append("personCode", `P2-ALPHA-${Date.now()}`);
    regForm1.append("category", "employee");
    regForm1.append("department", "Security");
    regForm1.append("status", "active");
    regForm1.append("image", makeDummyImageFile("personA.jpg"));

    const regReq1 = new NextRequest("http://localhost:3000/api/persons", {
      method: "POST",
      body: regForm1,
    });
    const regRes1 = await POST_PERSONS(regReq1);
    const regData1 = await regRes1.json();

    assert(
      regRes1.status === 201 && regData1.success === true && Boolean(regData1.person?.id),
      "1b. Final registration succeeds for unique face",
      JSON.stringify(regData1)
    );
    const personAId: number = regData1.person.id;
    createdPersonIds.push(personAId);

    // 2. Registering the same face image twice is blocked
    const precheckForm2 = new FormData();
    precheckForm2.append("image", makeDummyImageFile("personA_dup.jpg"));
    const precheckReq2 = new NextRequest("http://localhost:3000/api/persons/precheck", {
      method: "POST",
      body: precheckForm2,
    });
    const precheckRes2 = await POST_PRECHECK(precheckReq2);
    const precheckData2 = await precheckRes2.json();

    assert(
      precheckRes2.status === 409 &&
        precheckData2.canProceed === false &&
        precheckData2.isDuplicate === true &&
        precheckData2.status === "duplicate_face" &&
        precheckData2.message === REQUIRED_DUPLICATE_MESSAGE,
      "2a. Precheck blocks identical face registration with HTTP 409 and required duplicate message",
      JSON.stringify(precheckData2)
    );

    const regForm2 = new FormData();
    regForm2.append("firstName", "PhaseTwo");
    regForm2.append("lastName", "AlphaClone");
    regForm2.append("personCode", `P2-CLONE-${Date.now()}`);
    regForm2.append("category", "employee");
    regForm2.append("image", makeDummyImageFile("personA_dup.jpg"));
    const regReq2 = new NextRequest("http://localhost:3000/api/persons", {
      method: "POST",
      body: regForm2,
    });
    const regRes2 = await POST_PERSONS(regReq2);
    const regData2 = await regRes2.json();

    assert(
      regRes2.status === 409 &&
        regData2.success === false &&
        regData2.error === "DUPLICATE_FACE" &&
        regData2.message === REQUIRED_DUPLICATE_MESSAGE,
      "2b. Final registration route blocks identical face with HTTP 409 and required message",
      JSON.stringify(regData2)
    );

    // 3. Registering a different capture of an already-registered person is blocked when similarity >= 0.50
    currentMockEmbedding = personADifferentCaptureVec;
    const precheckForm3 = new FormData();
    precheckForm3.append("image", makeDummyImageFile("personA_angle2.jpg"));
    const precheckReq3 = new NextRequest("http://localhost:3000/api/persons/precheck", {
      method: "POST",
      body: precheckForm3,
    });
    const precheckRes3 = await POST_PRECHECK(precheckReq3);
    const precheckData3 = await precheckRes3.json();
    const matchedSim3 = precheckData3.matchingPerson?.similarity;

    assert(
      DEFAULT_DUPLICATE_SIMILARITY_THRESHOLD === 0.5 &&
        precheckRes3.status === 409 &&
        precheckData3.isDuplicate === true &&
        typeof matchedSim3 === "number" &&
        matchedSim3 >= 0.5 &&
        matchedSim3 < 0.85,
      `3. Different capture of already-registered person (similarity=${matchedSim3}) is blocked at threshold 0.50`,
      JSON.stringify(precheckData3)
    );

    // 4. Duplicate detection works when the matched person is inactive
    await prisma.person.update({
      where: { id: personAId },
      data: { status: "inactive" },
    });
    const inactiveDupCheck = await checkForDuplicateFace(personADifferentCaptureVec);
    assert(
      inactiveDupCheck.isDuplicate === true &&
        inactiveDupCheck.matchingPerson?.personId === personAId &&
        inactiveDupCheck.matchingPerson?.status === "inactive",
      "4. Duplicate detection catches matches against inactive people",
      JSON.stringify(inactiveDupCheck)
    );

    // 5. Duplicate detection works when the matched person is suspended
    await prisma.person.update({
      where: { id: personAId },
      data: { status: "suspended" },
    });
    const suspendedDupCheck = await checkForDuplicateFace(personADifferentCaptureVec);
    const precheckForm5 = new FormData();
    precheckForm5.append("image", makeDummyImageFile("personA_suspended.jpg"));
    const precheckRes5 = await POST_PRECHECK(
      new NextRequest("http://localhost:3000/api/persons/precheck", {
        method: "POST",
        body: precheckForm5,
      })
    );
    const precheckData5 = await precheckRes5.json();
    assert(
      suspendedDupCheck.isDuplicate === true &&
        suspendedDupCheck.matchingPerson?.status === "suspended" &&
        precheckRes5.status === 409 &&
        precheckData5.error === "DUPLICATE_FACE_DEACTIVATED",
      "5. Duplicate detection catches matches against suspended people",
      JSON.stringify(precheckData5)
    );

    // Restore Person A to active
    await prisma.person.update({
      where: { id: personAId },
      data: { status: "active" },
    });

    // 6. Replacing an existing person's own face does not fail because of that same person's old embedding
    currentMockEmbedding = personADifferentCaptureVec;
    const precheckSelfForm = new FormData();
    precheckSelfForm.append("image", makeDummyImageFile("personA_replace.jpg"));
    precheckSelfForm.append("excludePersonId", String(personAId));
    const precheckSelfRes = await POST_PRECHECK(
      new NextRequest("http://localhost:3000/api/persons/precheck", {
        method: "POST",
        body: precheckSelfForm,
      })
    );
    const precheckSelfData = await precheckSelfRes.json();

    assert(
      precheckSelfRes.status === 200 && precheckSelfData.canProceed === true && precheckSelfData.isDuplicate === false,
      "6a. Precheck with excludePersonId allows replacing a person's own face",
      JSON.stringify(precheckSelfData)
    );

    const replaceSelfForm = new FormData();
    replaceSelfForm.append("image", makeDummyImageFile("personA_replace.jpg"));
    const replaceSelfRes = await POST_REPLACE_FACE(
      new NextRequest(`http://localhost:3000/api/persons/${personAId}/face`, {
        method: "POST",
        body: replaceSelfForm,
      }),
      { params: Promise.resolve({ id: String(personAId) }) }
    );
    const replaceSelfData = await replaceSelfRes.json();
    const activeEmbeddingsAfterReplace = await prisma.faceEmbedding.count({
      where: { personId: personAId, isActive: true },
    });

    assert(
      replaceSelfRes.status === 200 && replaceSelfData.success === true && activeEmbeddingsAfterReplace === 1,
      "6b. POST /api/persons/[id]/face replaces own face and keeps exactly 1 active embedding",
      JSON.stringify(replaceSelfData)
    );

    // 7. Replacing an existing person's face with another registered person's face is blocked
    currentMockEmbedding = personBVec;
    const regFormB = new FormData();
    regFormB.append("firstName", "PhaseTwo");
    regFormB.append("lastName", "Bravo");
    regFormB.append("personCode", `P2-BRAVO-${Date.now()}`);
    regFormB.append("category", "employee");
    regFormB.append("image", makeDummyImageFile("personB.jpg"));
    const regResB = await POST_PERSONS(
      new NextRequest("http://localhost:3000/api/persons", {
        method: "POST",
        body: regFormB,
      })
    );
    const regDataB = await regResB.json();
    const personBId: number = regDataB.person.id;
    createdPersonIds.push(personBId);

    // Try replacing Person B's face with Person A's face
    currentMockEmbedding = personADifferentCaptureVec;
    const replaceCrossForm = new FormData();
    replaceCrossForm.append("image", makeDummyImageFile("personA_on_B.jpg"));
    const replaceCrossRes = await POST_REPLACE_FACE(
      new NextRequest(`http://localhost:3000/api/persons/${personBId}/face`, {
        method: "POST",
        body: replaceCrossForm,
      }),
      { params: Promise.resolve({ id: String(personBId) }) }
    );
    const replaceCrossData = await replaceCrossRes.json();

    assert(
      replaceCrossRes.status === 409 &&
        replaceCrossData.success === false &&
        replaceCrossData.message === REQUIRED_DUPLICATE_MESSAGE,
      "7. Replacing a person's face with another registered person's face is blocked with HTTP 409",
      JSON.stringify(replaceCrossData)
    );

    // 8. FastAPI or database failure during duplicate check blocks registration with a technical error
    shouldFailFastApi = true;
    const failPrecheckForm = new FormData();
    failPrecheckForm.append("image", makeDummyImageFile("fail.jpg"));
    const failPrecheckRes = await POST_PRECHECK(
      new NextRequest("http://localhost:3000/api/persons/precheck", {
        method: "POST",
        body: failPrecheckForm,
      })
    );
    const failPrecheckData = await failPrecheckRes.json();
    shouldFailFastApi = false;

    assert(
      (failPrecheckRes.status === 503 || failPrecheckRes.status === 500) &&
        failPrecheckData.success === false &&
        failPrecheckData.canProceed === false &&
        failPrecheckData.qualityStatus === "error",
      "8. FastAPI failure during precheck fails closed (HTTP 500/503, canProceed=false)",
      JSON.stringify(failPrecheckData)
    );

    // 9. Invalid or malformed embedding is rejected (never returns isDuplicate: false)
    let emptyRejected = false;
    let shortRejected = false;
    let nanRejected = false;
    let zeroNormRejected = false;

    try {
      await checkForDuplicateFace([]);
    } catch {
      emptyRejected = true;
    }
    try {
      await checkForDuplicateFace([0.1, 0.2, 0.3]);
    } catch {
      shortRejected = true;
    }
    try {
      const nanVec = [...personAVec];
      nanVec[10] = Number.NaN;
      validateEmbeddingVector(nanVec);
    } catch {
      nanRejected = true;
    }
    try {
      const zeroVec = new Array<number>(512).fill(0);
      await findTopFaceMatches(zeroVec);
    } catch {
      zeroNormRejected = true;
    }

    assert(
      emptyRejected && shortRejected && nanRejected && zeroNormRejected,
      "9. Malformed embeddings (empty, wrong dimension, NaN, zero-norm) throw validation errors and cannot bypass checks"
    );

    // 10. Concurrent duplicate registration attempts cannot create two records for the same face
    const concurrentVec = makeUnitVector(503, 504, 0.2);
    currentMockEmbedding = concurrentVec;

    const makeConcurrentReq = (suffix: string) => {
      const fd = new FormData();
      fd.append("firstName", "Concurrent");
      fd.append("lastName", suffix);
      fd.append("personCode", `P2-CONC-${suffix}-${Date.now()}`);
      fd.append("category", "visitor");
      fd.append("image", makeDummyImageFile(`conc_${suffix}.jpg`));
      return POST_PERSONS(
        new NextRequest("http://localhost:3000/api/persons", {
          method: "POST",
          body: fd,
        })
      );
    };

    const [concRes1, concRes2] = await Promise.all([makeConcurrentReq("One"), makeConcurrentReq("Two")]);
    const concData1 = await concRes1.json();
    const concData2 = await concRes2.json();
    if (concData1.person?.id) createdPersonIds.push(concData1.person.id);
    if (concData2.person?.id) createdPersonIds.push(concData2.person.id);

    const statuses = [concRes1.status, concRes2.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      `10. Concurrent duplicate registration attempts result in [201, 409] (got [${statuses.join(", ")}])`,
      JSON.stringify({ concData1, concData2 })
    );

    // =========================================================================
    // SECTION B: RECOGNITION AND AMBIGUITY TESTS (4 Tests)
    // =========================================================================
    console.log("\n--- Section B: Recognition Correctness & Ambiguity ---");

    // 11. Single best person match above threshold is recognized
    const matchResA = await findTopFaceMatches(personADifferentCaptureVec);
    assert(
      matchResA.matchStatus === "matched" && matchResA.person?.id === personAId,
      "11. Single best person match above threshold is recognized accurately",
      JSON.stringify(matchResA)
    );

    // 12. Multiple active embeddings for the same person do NOT cause false ambiguity
    const vectorLiteralExtra = `[${personAVec.join(",")}]`;
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO face_embeddings (
        person_id, embedding, embedding_model, image_path, quality_score, is_active, created_at, updated_at
      ) VALUES (
        $1, $2::vector, 'buffalo_s', 'https://ik.imagekit.io/test/extra.jpg', 0.95, true, NOW(), NOW()
      );
      `,
      personAId,
      vectorLiteralExtra
    );

    const multiEmbMatch = await findTopFaceMatches(personADifferentCaptureVec);

    assert(
      multiEmbMatch.matchStatus === "matched" && multiEmbMatch.person?.id === personAId,
      "12. Multiple active embeddings for the same person are deduplicated by person_id and never cause false ambiguity",
      JSON.stringify(multiEmbMatch)
    );

    // Clean up the extra active embedding on Person A
    const activeEmbsA = await prisma.faceEmbedding.findMany({
      where: { personId: personAId, isActive: true },
      orderBy: { id: "desc" },
    });
    if (activeEmbsA.length > 1) {
      await prisma.faceEmbedding.delete({ where: { id: activeEmbsA[0].id } });
    }

    // 13. Two different people within FACE_AMBIGUITY_MARGIN return status="ambiguous_match"
    const personC = await prisma.person.create({
      data: {
        personCode: `P2-CHARLIE-${Date.now()}`,
        firstName: "PhaseTwo",
        lastName: "Charlie",
        category: "employee",
        status: "active",
      },
    });
    createdPersonIds.push(personC.id);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO face_embeddings (
        person_id, embedding, embedding_model, image_path, quality_score, is_active, created_at, updated_at
      ) VALUES (
        $1, $2::vector, 'buffalo_s', 'https://ik.imagekit.io/test/charlie.jpg', 0.95, true, NOW(), NOW()
      );
      `,
      personC.id,
      `[${personCVec.join(",")}]`
    );

    const ambigRecognition = await findTopFaceMatches(personBVec);
    assert(
      ambigRecognition.matchStatus === "ambiguous" && ambigRecognition.person === null,
      "13a. findTopFaceMatches returns matchStatus='ambiguous' when two distinct people are within margin",
      JSON.stringify(ambigRecognition)
    );

    currentMockEmbedding = personBVec;
    const ambigAccessForm = new FormData();
    ambigAccessForm.append("image", makeDummyImageFile("ambiguous_scan.jpg"));
    const ambigAccessRes = await POST_ACCESS(
      new NextRequest("http://localhost:3000/api/access", {
        method: "POST",
        body: ambigAccessForm,
      })
    );
    const ambigAccessData = await ambigAccessRes.json();

    assert(
      ambigAccessRes.status === 200 &&
        ambigAccessData.status === "ambiguous_match" &&
        ambigAccessData.match_status === "ambiguous" &&
        ambigAccessData.access_status === "denied" &&
        ambigAccessData.reason === "insufficient_confidence" &&
        ambigAccessData.door_action === "lock",
      "13b. POST /api/access returns status='ambiguous_match', match_status='ambiguous', denied, insufficient_confidence, lock",
      JSON.stringify(ambigAccessData)
    );

    // Remove Person C's embedding so Person B is unambiguous again
    await prisma.faceEmbedding.deleteMany({ where: { personId: personC.id } });

    // 14. Unknown face below threshold returns unknown_individual
    currentMockEmbedding = unknownVec;
    const unknownAccessForm = new FormData();
    unknownAccessForm.append("image", makeDummyImageFile("unknown_scan.jpg"));
    const unknownAccessRes = await POST_ACCESS(
      new NextRequest("http://localhost:3000/api/access", {
        method: "POST",
        body: unknownAccessForm,
      })
    );
    const unknownAccessData = await unknownAccessRes.json();

    assert(
      unknownAccessRes.status === 200 &&
        unknownAccessData.status === "unknown_individual" &&
        unknownAccessData.match_status === "unknown" &&
        unknownAccessData.access_status === "denied" &&
        unknownAccessData.reason === "face_no_match" &&
        unknownAccessData.door_action === "lock",
      "14. Unknown face below threshold returns status='unknown_individual', match_status='unknown', reason='face_no_match', lock",
      JSON.stringify(unknownAccessData)
    );

    // =========================================================================
    // SECTION C: AUTHORIZATION, ALERTS, AND HISTORICAL LOG TESTS (5 Tests)
    // =========================================================================
    console.log("\n--- Section C: Authorization, Alerts & Historical Logs ---");

    // 15. Recognized active person -> granted, face_match, unlock
    currentMockEmbedding = personADifferentCaptureVec;
    const activeAccessForm = new FormData();
    activeAccessForm.append("image", makeDummyImageFile("active_scan.jpg"));
    const activeAccessRes = await POST_ACCESS(
      new NextRequest("http://localhost:3000/api/access", {
        method: "POST",
        body: activeAccessForm,
      })
    );
    const activeAccessData = await activeAccessRes.json();

    assert(
      activeAccessData.status === "known_individual" &&
        activeAccessData.match_status === "matched" &&
        activeAccessData.access_status === "granted" &&
        activeAccessData.reason === "face_match" &&
        activeAccessData.door_action === "unlock" &&
        activeAccessData.person?.id === personAId,
      "15. Recognized active person is granted access with reason='face_match' and door_action='unlock'",
      JSON.stringify(activeAccessData)
    );

    // 16. Recognized inactive person -> denied, unauthorized, lock + unauthorized_access alert
    await prisma.person.update({
      where: { id: personAId },
      data: { status: "inactive" },
    });

    const inactiveAccessForm = new FormData();
    inactiveAccessForm.append("image", makeDummyImageFile("inactive_scan.jpg"));
    const inactiveAccessRes = await POST_ACCESS(
      new NextRequest("http://localhost:3000/api/access", {
        method: "POST",
        body: inactiveAccessForm,
      })
    );
    const inactiveAccessData = await inactiveAccessRes.json();

    const inactiveLog = await prisma.accessLog.findFirst({
      where: { personId: personAId },
      orderBy: { id: "desc" },
    });
    const inactiveAlert = await prisma.alert.findFirst({
      where: { personId: personAId },
      orderBy: { id: "desc" },
    });

    assert(
      inactiveAccessData.status === "known_individual" &&
        inactiveAccessData.match_status === "matched" &&
        inactiveAccessData.access_status === "denied" &&
        inactiveAccessData.reason === "unauthorized" &&
        inactiveAccessData.door_action === "lock" &&
        inactiveLog?.reason === "unauthorized" &&
        inactiveAlert?.alertType === "unauthorized_access",
      "16. Recognized inactive person is denied with reason='unauthorized', lock, and creates 'unauthorized_access' alert (never face_no_match/unknown_face)",
      JSON.stringify({ inactiveAccessData, logReason: inactiveLog?.reason, alertType: inactiveAlert?.alertType })
    );

    // 17. Recognized suspended person -> denied, unauthorized, lock + unauthorized_access alert
    await prisma.person.update({
      where: { id: personAId },
      data: { status: "suspended" },
    });

    const suspendedAccessForm = new FormData();
    suspendedAccessForm.append("image", makeDummyImageFile("suspended_scan.jpg"));
    const suspendedAccessRes = await POST_ACCESS(
      new NextRequest("http://localhost:3000/api/access", {
        method: "POST",
        body: suspendedAccessForm,
      })
    );
    const suspendedAccessData = await suspendedAccessRes.json();

    const suspendedLog = await prisma.accessLog.findFirst({
      where: { personId: personAId },
      orderBy: { id: "desc" },
    });
    const suspendedAlert = await prisma.alert.findFirst({
      where: { personId: personAId },
      orderBy: { id: "desc" },
    });

    assert(
      suspendedAccessData.status === "known_individual" &&
        suspendedAccessData.match_status === "matched" &&
        suspendedAccessData.access_status === "denied" &&
        suspendedAccessData.reason === "unauthorized" &&
        suspendedAccessData.door_action === "lock" &&
        suspendedLog?.reason === "unauthorized" &&
        suspendedAlert?.alertType === "unauthorized_access" &&
        suspendedAlert.message.toLowerCase().includes("suspended"),
      "17. Recognized suspended person is denied with reason='unauthorized', lock, and creates 'unauthorized_access' alert",
      JSON.stringify({ suspendedAccessData, logReason: suspendedLog?.reason, alertMsg: suspendedAlert?.message })
    );

    // 18. Alert creation failure does NOT grant access or fail the response
    const originalAlertCreate = prisma.alert.create;
    (prisma.alert as unknown as { create: typeof prisma.alert.create }).create = (async () => {
      throw new Error("Simulated alert table write failure");
    }) as unknown as typeof prisma.alert.create;

    try {
      const alertFailForm = new FormData();
      alertFailForm.append("image", makeDummyImageFile("alert_fail_scan.jpg"));
      const alertFailRes = await POST_ACCESS(
        new NextRequest("http://localhost:3000/api/access", {
          method: "POST",
          body: alertFailForm,
        })
      );
      const alertFailData = await alertFailRes.json();

      assert(
        alertFailRes.status === 200 &&
          alertFailData.access_status === "denied" &&
          alertFailData.reason === "unauthorized" &&
          alertFailData.door_action === "lock",
        "18. Alert write failure during unauthorized attempt is caught and never grants access or breaks response",
        JSON.stringify(alertFailData)
      );
    } finally {
      (prisma.alert as unknown as { create: typeof prisma.alert.create }).create = originalAlertCreate;
    }

    // 19. Changing a person's status later does not rewrite the meaning of earlier historical access logs
    await prisma.person.update({
      where: { id: personAId },
      data: { status: "active" },
    });

    const historicalLogsForA = await prisma.accessLog.findMany({
      where: { personId: personAId },
      include: { person: true },
      orderBy: { id: "asc" },
    });

    const grantedHistoricalLog = historicalLogsForA.find((l) => l.accessStatus === "granted");
    const unauthorizedHistoricalLog = historicalLogsForA.find((l) => l.reason === "unauthorized");

    assert(
      Boolean(grantedHistoricalLog) &&
        grantedHistoricalLog?.reason === "face_match" &&
        Boolean(unauthorizedHistoricalLog) &&
        unauthorizedHistoricalLog?.reason === "unauthorized" &&
        unauthorizedHistoricalLog?.person?.status === "active",
      "19. Historical AccessLog preserves reason='unauthorized' even after person status is later changed back to 'active'",
      JSON.stringify({
        grantedReason: grantedHistoricalLog?.reason,
        unauthorizedReason: unauthorizedHistoricalLog?.reason,
        currentPersonStatus: unauthorizedHistoricalLog?.person?.status,
      })
    );
  } finally {
    // Restore mocks
    (auth.api as unknown as { getSession: typeof auth.api.getSession }).getSession = originalGetSession;
    global.fetch = originalFetch;
    ImageKit.prototype.upload = originalIkUpload;
    ImageKit.prototype.deleteFile = originalIkDeleteFile;

    // Clean up test records created during this test run
    await prisma.alert.deleteMany({
      where: {
        OR: [
          { personId: { in: createdPersonIds } },
          { person: { personCode: { startsWith: "P2-" } } },
        ],
      },
    }).catch(() => {});
    await prisma.accessLog.deleteMany({
      where: {
        OR: [
          { personId: { in: createdPersonIds } },
          { person: { personCode: { startsWith: "P2-" } } },
        ],
      },
    }).catch(() => {});
    await prisma.faceEmbedding.deleteMany({
      where: {
        OR: [
          { personId: { in: createdPersonIds } },
          { person: { personCode: { startsWith: "P2-" } } },
          { person: { firstName: { in: ["PhaseTwo", "Concurrent"] } } },
        ],
      },
    }).catch(() => {});
    await prisma.person.deleteMany({
      where: {
        OR: [
          { id: { in: createdPersonIds } },
          { personCode: { startsWith: "P2-" } },
          { firstName: { in: ["PhaseTwo", "Concurrent"] } },
        ],
      },
    }).catch(() => {});

    // Also clean up any unlinked test logs/alerts created for ambiguous/unknown scans during this test run
    await prisma.alert
      .deleteMany({
        where: {
          title: "Unknown Individual Detected",
          createdAt: { gte: new Date(Date.now() - 60000) },
          deviceId: null,
        },
      })
      .catch(() => {});
    await prisma.accessLog
      .deleteMany({
        where: {
          personId: null,
          deviceId: null,
          createdAt: { gte: new Date(Date.now() - 60000) },
          reason: { in: ["insufficient_confidence", "face_no_match"] },
        },
      })
      .catch(() => {});

    await prisma.$disconnect();
  }

  console.log("\n==============================================================");
  console.log(`  Phase 2 Test Summary: ${passed} Passed | ${failed} Failed`);
  console.log("==============================================================");
}

runPhase2RemediationTests().catch((err) => {
  console.error("Fatal error in Phase 2 tests:", err);
  process.exitCode = 1;
});
