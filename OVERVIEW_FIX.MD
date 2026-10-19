Viewed test-registration.ts:1-83
Viewed access-control.ts:1-180
Viewed access-client.ts:1-111
Viewed device-auth.ts:1-212
Viewed device-telemetry.ts:1-35
Viewed route.ts:1-484
Viewed route.ts:1-141
Viewed route.ts:1-123
Viewed route.ts:1-364
Viewed route.ts:1-93
Viewed route.ts:1-339
Viewed route.ts:1-198
Viewed route.ts:1-89
Viewed route.ts:1-55
Viewed route.ts:1-66
Viewed route.ts:1-159
Viewed route.ts:1-150
Viewed route.ts:1-219
Viewed route.ts:1-320
Viewed route.ts:1-132
Viewed route.ts:1-232
Viewed route.ts:1-160
Viewed route.ts:1-65
Viewed use-webcam.ts:1-359
Viewed use-system-health.ts:1-67
Viewed health.ts:1-11
Viewed audio.ts:1-90
Viewed get-session.ts:1-9
Viewed auth.ts:1-71
Viewed page.tsx:1-30
Viewed register-form.tsx:1-517
Viewed page.tsx:1-655
Viewed access-result-card.tsx:1-566
Viewed live-camera-preview.tsx:1-674
Viewed live-scan-controls.tsx:1-154
Viewed webcam-capture-modal.tsx:1-193
Viewed replace-face-modal.tsx:1-190
Viewed person-modal.tsx:1-342
Viewed person-details-client-actions.tsx:1-118
Viewed persons-client-actions.tsx:1-366
Viewed page.tsx:1-257
Viewed page.tsx:1-258
Viewed page.tsx:1-159
Viewed page.tsx:1-166
Viewed page.tsx:1-175
Viewed page.tsx:1-292
Viewed page.tsx:1-308
Viewed apply-hnsw-index.ts:1-20
Viewed repair-imagekit-urls.ts:1-92
Viewed access-control.test.ts:1-200
Viewed access.test.ts:1-170
Viewed dashboard.test.ts:1-105
Viewed devices.test.ts:1-339
Viewed health-sync.test.ts:1-72
Viewed imagekit-url.test.ts:1-100
Viewed management.test.ts:1-320
Viewed recognition.test.ts:1-170
Viewed webcam-simulation.test.ts:1-119
Viewed layout.tsx:1-105
Viewed recent-access-table.tsx:1-329
Viewed security-alerts-panel.tsx:1-193

# IntelliGuard Codebase Audit and Remediation Proposal

> **Audit Scope & Constraints Note**: This audit was conducted strictly in **read-only mode** across the entire repository (`frontend/` and `ai-service/`). No files, dependencies, migrations, or database records were modified. Per your instructions, **liveness/anti-spoofing (Cases 8 & 9)** is documented as inspected but excluded from current acceptance requirements, and **hardware-dependent behaviors (Cases 10–15)** are separated into software-testable pipeline behaviors versus physical ESP32-S3-CAM integration requirements.

---

## A. Executive Summary

### Overall Readiness
IntelliGuard has a well-structured foundation: the Next.js App Router backend, FastAPI AI microservice (YOLOv8n + InsightFace `buffalo_s`), and PostgreSQL + `pgvector` database work together end-to-end for basic enrollment and live webcam simulation. However, **11 high-impact gaps across security, recognition correctness, error-state classification, quality validation, and UI state management** prevent the software pipeline from reliably satisfying the 15-scenario specification.

### What Currently Works
1. **End-to-End Biometric Registration**: Capturing or uploading a face (`POST /api/persons`), generating a 512-D L2-normalized ArcFace embedding via FastAPI (`POST /api/v1/embedding`), checking for duplicate identities via `pgvector` (`>= 0.85` cosine similarity), uploading the reference image to ImageKit with rollback cleanup on DB failure, and storing the person + vector atomically in PostgreSQL.
2. **Core Recognition Pipeline (Cases 1, 2, 4, 5)**: Live webcam simulation (`POST /api/access`) forwards frames to FastAPI (`POST /api/v1/analyze`), which runs YOLOv8n person detection followed by InsightFace face detection and embedding extraction, then performs a `pgvector` cosine distance (`<=>`) search and records `AccessLog` and `Alert` rows.
3. **Liveness Non-Interference**: Although `LivenessDetector` exists in [`ai-service/app/core/liveness.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/core/liveness.py), it is not instantiated in [`ai-service/app/main.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/main.py) and `analyze.py` returns `liveness_status: null`, which Next.js safely ignores—so **liveness does not block normal recognition**.
4. **Device Authentication Utility**: [`authenticateDeviceRequest`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/device-auth.ts#L50-L153) properly verifies `x-device-serial` + `x-device-api-key` using timing-safe SHA-256 comparison (`crypto.timingSafeEqual`) when device headers are supplied.

### Critical Blockers & Architectural Divergences
1. **Unauthenticated API Routes Exposing Biometric/PII Logs & Alert Controls (P0 Security)**: `GET /api/alerts`, `PATCH /api/alerts/[id]`, `GET /api/dashboard/activity`, `GET /api/dashboard/stats`, and `GET /api/dashboard/health` omit `getServerSession()` checks, allowing unauthenticated requests to read person names/photos/logs and resolve security alerts.
2. **Database / Vector Search Failure Misclassified as `"Unknown Individual"` (P1 — Violates Case 12)**: If `findTopFaceMatches()` throws a database/pgvector error in [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L337-L482), the outer `catch` returns HTTP 500 without `status: "recognition_error"`, causing [`WebcamSimulationPage`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L255-L333) to display `"ACCESS DENIED"` and record `"Unknown Individual"` in the scan history.
3. **Ambiguous Match Returned with `status: "unknown_individual"` (P1 — Violates Case 7)**: [`POST /api/access`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L341) sets `finalStatus = recognition.matchStatus === "matched" ? "known_individual" : "unknown_individual"`, conflating ambiguous matches (`match_status: "ambiguous"`) with unknown individuals.
4. **Same-Person Multi-Embedding False Ambiguity Bug (P1)**: [`findTopFaceMatches`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/face-recognition.ts#L81-L195) queries `face_embeddings` without grouping by `person_id` or checking `bestCandidate.personId !== secondCandidate.personId`. If a person has >1 active embedding, they compete against themselves and trigger false `"ambiguous"` denials.
5. **Deactivated/Suspended Person Stored with `reason: "face_no_match"` (P1 — Violates Case 3)**: [`evaluateAccess`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-control.ts#L145-L154) returns `reason: "face_no_match"` when a recognized person is `inactive` or `suspended`, corrupting the audit log (`matchStatus: "matched"` paired with `reason: "face_no_match"`).
6. **Quality Metric Flaw & Registration/Recognition Asymmetry (P1 — Violates Case 6)**: In [`ai-service/app/core/quality.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/core/quality.py#L22-L108), `0.4 * confidence + 0.3 * size_score + 0.3 * sharpness_score` allows a completely blurry image (`sharpness = 0.0`) to score `0.70` and pass recognition (`threshold = 0.50`), while brightness/darkness and alignment are never checked. Moreover, registration precheck (`POST /api/persons/precheck`) only checks `det_score >= 0.80` (`"optimal"`), contradicting registration submission (`qualityScore >= 0.70`).
7. **Repeated Denied Attempts Not Tracked or Escalated (P1 — Violates Case 15)**: Every single unknown scan creates an isolated `Alert` row with no sliding-window counter, no escalation to a `"Repeated Denied Attempts"` security alert, and no cooldown/rate limiting.

---

## B. Actual Architecture

### Architectural Ownership vs. Problem Statement
* **Next.js Backend (`frontend/`)** owns **PostgreSQL (`pgvector`) persistence, vector similarity queries, authorization checks, audit logging (`AccessLog`), and security alerting (`Alert`)**.
* **FastAPI AI Service (`ai-service/`)** is a **stateless computer-vision microservice**. It does **not** connect to PostgreSQL; it performs image decoding, YOLOv8n person detection, InsightFace (`buffalo_s`) face detection + 512-D embedding extraction, and face quality scoring, returning JSON to Next.js.

### 1. Registration Execution Path
```
[Browser Webcam / Upload]
  │  (Optional Precheck)
  ├─► POST /api/persons/precheck (frontend/app/api/persons/precheck/route.ts)
  │     └─► detectFace() (frontend/lib/ai/fastapi.ts)
  │           └─► POST /api/v1/detect (ai-service/app/api/v1/endpoints/detect.py)
  │                 └─► InsightFace buffalo_s detect_faces() [No quality_score computed]
  │
  └─► POST /api/persons (frontend/app/api/persons/route.ts)
        ├─► 1. Session Auth check (getServerSession)
        ├─► 2. Validate form fields & PersonCode uniqueness (prisma.person.findUnique)
        ├─► 3. generateEmbedding() (frontend/lib/ai/fastapi.ts)
        │     ├─► POST /api/v1/embedding (ai-service/app/api/v1/endpoints/embedding.py)
        │     │     ├─► validate_and_decode_image() (app/core/image.py)
        │     │     ├─► insightface_model.extract_embedding() (rejects 0 or >1 faces)
        │     │     └─► compute_face_quality() (app/core/quality.py)
        │     └─► Enforce qualityScore >= 0.70 (MIN_FACE_QUALITY in lib/ai/fastapi.ts)
        ├─► 4. checkForDuplicateFace() (frontend/lib/ai/duplicate-check.ts)
        │     └─► Raw SQL pgvector query: 1 - (fe.embedding <=> $1::vector) >= 0.85
        ├─► 5. uploadFaceImage() to ImageKit (frontend/lib/ai/imagekit.ts)
        └─► 6. prisma.$transaction:
              ├─► tx.person.create(...)
              └─► tx.$executeRawUnsafe("INSERT INTO face_embeddings ... $2::vector")
              (On DB error: deleteFaceImage(uploadedFileId) cleans up ImageKit)
```

### 2. Recognition & Access-Control Execution Path
```
[WebcamSimulationPage (frontend/app/dashboard/simulation/page.tsx) OR ESP32-S3-CAM]
  │
  └─► scanFace() (frontend/lib/access/access-client.ts)
        └─► POST /api/access (frontend/app/api/access/route.ts)
              ├─► 1. Dual Auth:
              │     ├─► If x-device-serial / x-device-api-key present:
              │     │     authenticateDeviceRequest() (lib/access/device-auth.ts)
              │     └─► Else: getServerSession() (web simulation session)
              ├─► 2. analyzeImage() (frontend/lib/ai/fastapi.ts)
              │     └─► POST /api/v1/analyze (ai-service/app/api/v1/endpoints/analyze.py)
              │           ├─► Step 1: yolo_detector.detect_persons() (YOLOv8n, conf >= 0.45)
              │           │     └─► If 0 persons -> status: "no_person"
              │           ├─► Step 2: insightface_model.detect_faces_and_embeddings()
              │           │     └─► Match primary face to person box -> If 0 faces -> status: "no_face"
              │           ├─► Step 3: compute_face_quality() (app/core/quality.py)
              │           │     └─► If quality_score < 0.50 -> status: "poor_quality"
              │           ├─► Step 4: Liveness [Currently bypassed: liveness_status = null]
              │           └─► Step 5: Verify 512-D embedding -> status: "ready_for_recognition"
              ├─► 3. Early Returns for Non-Recognition States:
              │     ├─► no_person / no_face / poor_quality -> Return 200 (No DB AccessLog written)
              │     └─► recognition_error -> Return 200 (Bug: No DB AccessLog/Alert written)
              ├─► 4. Vector Similarity Search:
              │     └─► findTopFaceMatches(embedding, threshold=0.50, margin=0.05, topN=2)
              │           (frontend/lib/ai/face-recognition.ts via pgvector <=>)
              │           Returns matchStatus: "matched" | "ambiguous" | "unknown"
              ├─► 5. Authorization Check:
              │     └─► evaluateAccess() (frontend/lib/access/access-control.ts)
              │           Checks matchStatus === "matched" AND person.status === "active"
              ├─► 6. Decision Recording:
              │     ├─► prisma.accessLog.create(...)
              │     └─► If reason === "face_no_match": prisma.alert.create(alertType: "unknown_face")
              └─► 7. Return AccessScanResponse JSON to Client / ESP32
```

---

## C. Scenario Compliance Matrix

| Scenario | Current Status | Code Evidence | Gaps / Bugs | Proposed Fix | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Registration Process** | **Partially Implemented** | [`app/api/persons/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/persons/route.ts#L105-L343), [`app/api/persons/precheck/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/persons/precheck/route.ts#L1-L82), [`lib/ai/fastapi.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/fastapi.ts#L38-L185), [`lib/ai/duplicate-check.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/duplicate-check.ts#L28-L82), [`endpoints/embedding.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/api/v1/endpoints/embedding.py#L19-L119) | 1. **Precheck vs. Submit mismatch**: `/api/persons/precheck` calls `/api/v1/detect`, which only checks `det_score >= 0.80` (`"optimal"`) and ignores `quality_score`, whereas `/api/persons` requires `qualityScore >= 0.70`.<br>2. **Schema lacks department/location permissions**: `Person` only has `category` (`Staff`/`Student`/`Visitor`/`Contractor`) and `status` (`active`/`inactive`/`suspended`).<br>3. **Replace Face Modal (`PUT /api/persons/[id]/face`)** skips `checkForDuplicateFace()`, allowing a registered person's face to be replaced with another already-registered person's face. | 1. Compute and return `quality_score` in `/api/v1/detect` and align `/api/persons/precheck` with `MIN_FACE_QUALITY`.<br>2. Add `checkForDuplicateFace(embedding, undefined, personId)` (excluding self) in [`app/api/persons/[id]/face/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/persons/%5Bid%5D/face/route.ts#L112-L162). | **P1** |
| **Case 1: Recognized & Authorized** | **Implemented** | [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L337-L466), [`lib/access/access-control.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-control.ts#L127-L165), [`simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L239-L261) | Works when person has 1 active embedding and `status === "active"`. Returns `access_status: "granted"`, `door_action: "unlock"`, plays granted chime, shows green `"ACCESS GRANTED"` overlay, and logs `AccessLog`. | None for single-embedding active users (see Case 7 for multi-embedding bug). | **P2** |
| **Case 2: Unknown Individual** | **Implemented** | [`lib/ai/face-recognition.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/face-recognition.ts#L168-L176), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L384-L407), [`simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L264-L269) | Returns `status: "unknown_individual"`, `match_status: "unknown"`, `access_status: "denied"`, `reason: "face_no_match"`, creates `AccessLog` and `Alert` (`unknown_face`), plays error chime, and displays `"ACCESS DENIED — UNKNOWN FACE"`. | Alert spam on continuous auto-scan (addressed under Case 15). | **P2** |
| **Case 3: Recognized but Unauthorized** | **Partially Implemented** | [`lib/access/access-control.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-control.ts#L145-L154), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L384-L407), [`prisma/schema.prisma`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/prisma/schema.prisma#L198-L206), [`recent-access-table.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/components/dashboard/recent-access-table.tsx#L306-L310) | 1. **Wrong denial reason stored**: `evaluateAccess()` returns `reason: "face_no_match"` when `person.status !== "active"`. This records `matchStatus: "matched"` with `reason: "face_no_match"` in `access_logs`!<br>2. **Spurious `"Unknown Individual Detected"` alert**: Because `reason === "face_no_match"` (`route.ts` line 384), an `"Unknown Individual Detected"` alert (`alertType: "unknown_face"`) is created for a known, recognized employee whose account is inactive!<br>3. **Live status coupling in logs UI**: `RecentAccessTable` and `AccessLogsPage` check `evt.person.status !== "active"` at render time; if the user is later reactivated, historical logs revert to showing `"FACE NO MATCH"`.<br>4. **Missing `"suspended"` status UI**: `PersonModal` (`person-modal.tsx`) and status toggles only support `"active"` / `"inactive"`. | 1. Add `unauthorized_inactive` / `unauthorized_suspended` (or `account_inactive`) to `AccessReason` enum and `AlertType` (`unauthorized_access`).<br>2. Return the distinct reason from `evaluateAccess()`.<br>3. Generate an `"Unauthorized Access Attempt"` alert (referencing the matched person) instead of `"Unknown Individual Detected"`.<br>4. Allow selecting `"suspended"` status in person management UI. | **P1** |
| **Case 4: No Person Detected** | **Implemented** | [`endpoints/analyze.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/api/v1/endpoints/analyze.py#L99-L129), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L179-L216), [`simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L279-L287) | Returns `status: "no_person"`, `reason: "no_person_detected"`, skips DB `AccessLog`/`Alert`, plays no sound, and displays neutral `"WAITING FOR PERSON"`.<br>**Minor edge case**: If a user holds their face very close to the webcam so YOLOv8n (`conf >= 0.45`) misses the `person` bounding box, `/api/v1/analyze` returns `no_person` without checking InsightFace. | Fallback in `/api/v1/analyze`: if YOLOv8n finds `0` persons, optionally check InsightFace or lower YOLO person threshold for close-up webcam frames. | **P2** |
| **Case 5: Person Detected, No Face Visible** | **Implemented** | [`endpoints/analyze.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/api/v1/endpoints/analyze.py#L131-L185), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L179-L216), [`simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L279-L287) | Returns `status: "no_face"`, `reason: "no_face_detected"`, skips DB `AccessLog`/`Alert`, plays no sound, and displays `"FACE NOT DETECTED — PLEASE FACE CAMERA"`. | None. | **P3** |
| **Case 6: Face Detected, Insufficient Quality** | **Partially Implemented** | [`ai-service/app/core/quality.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/core/quality.py#L22-L108), [`endpoints/analyze.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/api/v1/endpoints/analyze.py#L187-L221), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L179-L216) | 1. **Flawed additive formula**: `0.4 * confidence + 0.3 * size_score + 0.3 * sharpness_score` in `quality.py` means a completely blurry face (`sharpness_score = 0.0`) with `size >= 112px` (`size_score = 1.0`) and `confidence = 0.85` gets `quality_score = 0.64 >= 0.50` and **passes** recognition!<br>2. **No brightness/darkness or alignment check**: `quality.py` only measures bbox size and Laplacian variance; dark/underexposed or extreme-pose faces are not gated.<br>3. **Threshold mismatch**: Registration requires `0.70`, recognition requires `0.50`. | 1. Enforce minimum per-factor floors in `compute_face_quality()` (e.g., reject if `sharpness_score < 0.25`, `size_score < 0.40`, or mean luminance `< 35` or `> 235`) in addition to the composite threshold.<br>2. Make quality threshold configurable in `Settings` (`config.py`) and return specific quality failure reasons (`blurry`, `too_dark`, `too_small`). | **P1** |
| **Case 7: Ambiguous Identity Match** | **Broken / Partially Implemented** | [`lib/ai/face-recognition.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/face-recognition.ts#L81-L195), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L341-L416), [`access-result-card.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/components/ai/access-result-card.tsx#L99-L103), [`simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L240-L274) | 1. **API Contract Bug**: `route.ts` line 341 sets `finalStatus = recognition.matchStatus === "matched" ? "known_individual" : "unknown_individual"`. For ambiguous matches, `status` is `"unknown_individual"` instead of `"ambiguous_match"`.<br>2. **UI conflict**: In `AccessResultCard`, `isUnknown` (`result.status === "unknown_individual"`) and `isAmbiguous` (`result.match_status === "ambiguous"`) are **both true**, styling the snapshot frame as unknown/red while playing the unknown-individual error chime.<br>3. **Same-person multi-embedding bug**: `findTopFaceMatches` does not group by `person_id`; 2 embeddings for the same person trigger false ambiguity. | 1. Add `"ambiguous_match"` to `AccessScanResponse["status"]` and set `finalStatus = "ambiguous_match"` when `recognition.matchStatus === "ambiguous"`.<br>2. Deduplicate by `person_id` in `findTopFaceMatches` (`DISTINCT ON (fe.person_id)` ordered by `<=>` in a CTE). | **P1** |
| **Case 8: Suspected Spoof / Presentation Attack** | **Excluded (Dormant Scaffolding Present)** | [`ai-service/app/core/liveness.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/core/liveness.py#L1-L265), [`endpoints/analyze.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/api/v1/endpoints/analyze.py#L223-L227), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L218-L256) | **Excluded from current acceptance requirements.** Note for future re-introduction: `app/api/access/route.ts` returns early on `spoof_detected` (lines 218–256) **without** writing an `AccessLog` or `Alert` to PostgreSQL, and `VALID_REASONS` in `app/api/access/logs/route.ts` omits `"spoof_detected"`. | No action required for current milestone. Documented for future phase. | **P3 (Excluded)** |
| **Case 9: Liveness Inconclusive / Fails Technically** | **Excluded (Dormant Scaffolding Present)** | [`ai-service/app/core/liveness.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/core/liveness.py#L118-L162), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L258-L294) | **Excluded from current acceptance requirements.** Currently bypassed (`liveness_status: null`); does not interfere with non-liveness recognition. | No action required for current milestone. | **P3 (Excluded)** |
| **Case 10: Camera Failure** | **Partially Implemented (Software-Testable via Browser Webcam)** | [`hooks/use-webcam.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/hooks/use-webcam.ts#L31-L82), [`live-camera-preview.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/components/ai/live-camera-preview.tsx#L194-L209), [`app/api/devices/[id]/health/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/devices/%5Bid%5D/health/route.ts#L1-L157) | *Software*: `useWebcam` catches `NotAllowedError` / `NotFoundError` / `NotReadableError` and `captureFrame()` returns `null` if video dimensions are 0. However, if the camera stream disconnects mid-session during auto-scan (`captureFrame()` returns `null` at [`simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L152-L157)), `performScan` only shows a toast in manual mode and fails silently in auto-scan mode without stopping auto-scan or displaying `"CAMERA ERROR"`.<br>*Hardware*: ESP32-S3-CAM OV5640 init failure reporting via `POST /api/devices/[id]/health` (`status: "error"`) works, but does not log an `Alert`. | 1. Listen for media track `"ended"` event in `useWebcam` and transition to `error` state.<br>2. When `captureFrame()` fails in `simulation/page.tsx`, stop auto-scan and set overlay to `"CAMERA ERROR"`. | **P2** |
| **Case 11: Network or Backend Unavailable** | **Partially Implemented (Software-Testable)** | [`lib/ai/fastapi.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/fastapi.ts#L50-L92), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L146-L176), [`simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L363-L366) | 1. **Browser -> Next.js disconnect**: When `scanFace()` throws in [`simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L363-L366), `catch (err)` only shows a toast! It leaves the previous scan's `"ACCESS GRANTED"` card and bounding boxes on screen and does not show `"SYSTEM UNAVAILABLE — TRY AGAIN"`.<br>2. **Next.js -> FastAPI failure**: `route.ts` catches `FastAPIError`, logs `AccessLog` (`system_error`) and `Alert` (`device_offline`), and returns 502. However, it labels **all** `FastAPIError`s (including 400 `INVALID_IMAGE`) as `"AI Service Unavailable"` (502). | 1. In `simulation/page.tsx` `catch (err)`, set `cameraOverlay` to `"SYSTEM UNAVAILABLE — TRY AGAIN"` (`status: "error"`), clear bounding boxes, and set an error result card.<br>2. Distinguish 400 client image errors from 502/503 AI service unavailability in `route.ts`. | **P1** |
| **Case 12: Database or Vector Search Failure** | **Broken (Software-Testable)** | [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L337-L482), [`lib/access/access-client.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-client.ts#L86-L108), [`simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L255-L333) | 1. When `findTopFaceMatches()` throws a DB error, `route.ts` line 467 returns HTTP 500 with `access_status: "denied", reason: "system_error"` but **omits** `status: "recognition_error"` and `match_status: "error"`.<br>2. `scanFace()` line 92 checks `if (!response.ok && !data.access_status)`—since `data.access_status` is `"denied"`, it does not populate `data.status`!<br>3. `simulation/page.tsx` falls through to `"ACCESS DENIED"` (instead of `"VERIFICATION ERROR"`) and **logs the event in the UI Scan History as `"Unknown Individual"`**! | 1. Wrap `findTopFaceMatches()` in `try/catch` in `route.ts`, returning `status: "recognition_error"`, `match_status: "error"`, `access_status: "denied"`, `reason: "system_error"`, `message: "VERIFICATION ERROR"`.<br>2. Fix `simulation/page.tsx` history entry and overlay so `reason === "system_error"` never displays `"Unknown Individual"`. | **P0 / P1** |
| **Case 13: Invalid or Unauthenticated Device Request** | **Partially Implemented (Software-Testable via HTTP headers)** | [`lib/access/device-auth.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/device-auth.ts#L50-L153), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L34-L82), [`app/api/alerts/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/alerts/route.ts#L1-L70) | 1. **Device auth security events not persisted in DB**: When `authenticateDeviceRequest()` fails (invalid key, unknown serial, retired device), `route.ts` only calls `console.warn()`—it does **not** record an `Alert` or security audit event in PostgreSQL.<br>2. **Partial header bypass**: In `route.ts` line 37 (`if (hasDeviceHeaders && (serialHeader || apiKeyHeader))`), if a request sends empty strings for `x-device-serial: ""`, it falls back to checking web session cookies.<br>3. **Unauthenticated API routes (P0)**: `/api/alerts`, `/api/alerts/[id]`, `/api/dashboard/activity`, `/api/dashboard/stats`, and `/api/dashboard/health` have **no authentication checks at all**. | 1. Create a security `Alert` (`high` severity) in DB when `authenticateDeviceRequest` fails.<br>2. Add `getServerSession()` enforcement to all unprotected dashboard/alerts API routes. | **P0** |
| **Case 14: Processing Timeout or Invalid AI Response** | **Partially Implemented (Software-Testable)** | [`lib/ai/fastapi.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/fastapi.ts#L50-L92), [`endpoints/analyze.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/api/v1/endpoints/analyze.py#L229-L258), [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L258-L294) | 1. **AI `recognition_error` not logged in DB**: When FastAPI returns `status: "recognition_error"` (e.g., invalid/missing 512-D embedding in `analyze.py` line 231), `route.ts` lines 258–294 returns HTTP 200 **without** creating an `AccessLog` or `Alert` in PostgreSQL.<br>2. **No structural validation of AI response**: `analyzeImage()` in `lib/ai/fastapi.ts` casts `response.json()` directly to `UnifiedAnalysisResponse` without validating that `embedding` is a finite 512-number array when `status === "ready_for_recognition"`. | 1. Validate `Array.isArray(result.embedding) && result.embedding.length === 512` in `analyzeImage()` (`lib/ai/fastapi.ts`) and `route.ts`.<br>2. Record an `AccessLog` (`reason: "system_error"`, `matchStatus: "error"`) when `aiResult.status === "recognition_error"`. | **P1** |
| **Case 15: Repeated Denied Attempts** | **Missing (Software-Testable)** | [`app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L384-L407), [`prisma/schema.prisma`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/prisma/schema.prisma#L97-L133) | Completely unimplemented. Every single unknown-face scan creates a separate `medium`-severity `Alert` (`"Unknown Individual Detected"`). There is no sliding time window check (e.g., $\ge 3$ denied attempts within 60 seconds), no escalation to a `high`/`critical` `"SECURITY ALERT — REPEATED DENIED ATTEMPTS"`, and no alert deduplication/cooldown. | Query recent denied `AccessLog` count within a configurable window (e.g., last 60s for same device/source) in `POST /api/access`. If count $\ge 3$, escalate alert severity to `"high"`/`"critical"`, return `security_alert: true` in response, and show `"SECURITY ALERT — REPEATED DENIED ATTEMPTS"` on the OLED/simulation overlay. | **P1** |

---

## D. Frontend–Backend Contract Issues

1. **Missing `status` and `match_status` on HTTP 500 Responses (`POST /api/access`)**
   * **Evidence**: [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L467-L482) and [`frontend/lib/access/access-client.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-client.ts#L92-L103).
   * **Issue**: On an unhandled exception (such as a `pgvector` query error), `route.ts` returns `{ success: false, access_status: "denied", reason: "system_error", door_action: "keep_locked", message: ... }` without `status` or `match_status`. In `scanFace()`, the fallback `if (!response.ok && !data.access_status)` does **not** run because `data.access_status` is truthy (`"denied"`). As a result, `response.status` is `undefined` on the frontend, causing [`WebcamSimulationPage`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L276-L333) to treat a backend/database crash as an `"ACCESS DENIED"` / `"Unknown Individual"` event.

2. **Ambiguous Match Collides with `status: "unknown_individual"`**
   * **Evidence**: [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L341) and [`frontend/components/ai/access-result-card.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/components/ai/access-result-card.tsx#L99-L103).
   * **Issue**: `route.ts` sets `status: "unknown_individual"` whenever `recognition.matchStatus !== "matched"` (including `"ambiguous"`). In `AccessResultCard`, `const isUnknown = result?.status === "unknown_individual"` and `const isAmbiguous = result?.match_status === "ambiguous" || result?.reason === "ambiguous_match"` are **both true** at the same time.

3. **Registration Precheck (`/api/persons/precheck`) vs. Submission (`/api/persons`) Contract Mismatch**
   * **Evidence**: [`frontend/app/api/persons/precheck/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/persons/precheck/route.ts#L35-L71) vs. [`frontend/lib/ai/fastapi.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/fastapi.ts#L38-L180).
   * **Issue**: `/api/persons/precheck` calls `/api/v1/detect` (`detect.py`), which returns only `confidence` (`det_score`) and `bbox`—it does not run `compute_face_quality()`. `precheck/route.ts` labels any face with `confidence >= 0.80` as `quality: "optimal"`. When the admin clicks **Enroll Person**, `/api/persons` calls `generateEmbedding()` (`/api/v1/embedding`), which computes `quality_score` and rejects if `qualityScore < 0.70` (`POOR_QUALITY`).

4. **Premature Snapshot Replacement & Missing Loading State on Subsequent Scans (`WebcamSimulationPage`)**
   * **Evidence**: [`frontend/app/dashboard/simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L163-L165) and [`line 565`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L565).
   * **Issue**:
     * Line 164 sets `setCapturedImageUrl(nextImageUrl)` **before** `await scanFace(imageBlob)` resolves.
     * Line 565 passes `isLoading={isScanning && !latestResult}` to `AccessResultCard`.
     * Consequently, on every scan after the first (`latestResult !== null`), the card continues showing the **previous** scan's decision badge (`ACCESS GRANTED` and the previous employee's name) with the **new** scan's live photo while the request is in flight!

5. **Stale Bounding Boxes Persist After Overlay Timeout or Network Error**
   * **Evidence**: [`frontend/app/dashboard/simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L289-L297) and [`lines 363–366`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L363-L366).
   * **Issue**: `overlayTimerRef` clears `cameraOverlay` after 3.5s/8s, but **never clears `detectedPersons` or `detectedFaces`**. Frozen bounding boxes remain drawn over the live video feed until another scan completes.

6. **Duplicate / Legacy Endpoint `POST /api/access/recognize`**
   * **Evidence**: [`frontend/app/api/access/recognize/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/recognize/route.ts#L1-L157).
   * **Issue**: Uses `generateEmbedding()` (`/api/v1/embedding`, which fails if >1 face is in frame and skips YOLOv8n), does not run `evaluateAccess()`, and writes no `AccessLog` or `Alert`. It is unused by the UI and only referenced by [`frontend/tests/recognition.test.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/tests/recognition.test.ts).

7. **Prisma `AccessReason` Enum vs. TypeScript `AccessReason` Union Mismatch**
   * **Evidence**: [`frontend/prisma/schema.prisma`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/prisma/schema.prisma#L198-L206), [`frontend/lib/access/access-control.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-control.ts#L16-L25), and [`frontend/app/api/access/logs/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/logs/route.ts#L8-L15).
   * **Issue**:
     * `schema.prisma` defines `AccessReason` as `face_matched`, `face_no_match`, `ambiguous_match`, `spoof_detected`, `liveness_inconclusive`, `system_error`, `manual_override`.
     * It lacks `unauthorized` / `account_inactive` (for Case 3).
     * `app/api/access/logs/route.ts` defines `VALID_REASONS` without `"spoof_detected"`.

---

## E. Database and Recognition Issues

1. **Same-Person Multi-Embedding False Ambiguity (`findTopFaceMatches`)**
   * **Evidence**: [`frontend/lib/ai/face-recognition.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/face-recognition.ts#L81-L157).
   * **Root Cause**: The SQL query selects top $N$ rows directly from `face_embeddings fe INNER JOIN persons p ON p.id = fe.person_id WHERE fe.is_active = true`. Although `PUT /api/persons/[id]/face` currently deactivates old embeddings (`is_active = false`), the schema explicitly supports 1-to-many active embeddings per person. If a person ever has 2 active embeddings (e.g., with/without glasses), both return with high similarity (e.g., `0.84` and `0.82`), `margin = 0.02 < 0.05`, and `findTopFaceMatches()` rejects the person as `"ambiguous"` against themselves!
   * **Fix**: Use `SELECT DISTINCT ON (fe.person_id)` in a subquery/CTE ordered by `fe.person_id, (fe.embedding <=> $1::vector) ASC`, then order the outer query by `cosine_distance ASC LIMIT $2`, and also verify `secondCandidate.personId !== bestCandidate.personId` in TypeScript.

2. **Quality Scoring Formula Allows Completely Blurry Faces in Recognition**
   * **Evidence**: [`ai-service/app/core/quality.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/core/quality.py#L22-L108) and [`ai-service/app/api/v1/endpoints/analyze.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/api/v1/endpoints/analyze.py#L196).
   * **Root Cause**:
     $$\text{composite\_score} = 0.4 \times \text{confidence} + 0.3 \times \text{size\_score} + 0.3 \times \text{sharpness\_score}$$
     When a face is $\ge 112\times 112$ px (`size_score = 1.0`) and SCRFD detection confidence is `0.85` (`0.4 * 0.85 = 0.34`), the first two terms alone sum to `0.64`. Even if `sharpness_score = 0.0` (Laplacian variance = 0, completely blurred), `0.64 >= 0.50`, so `/api/v1/analyze` never triggers `poor_quality`! Additionally, luminance (dark/overexposed image) is never checked.

3. **Deactivated/Suspended Users Trigger `"face_no_match"` and `"Unknown Individual"` Alerts**
   * **Evidence**: [`frontend/lib/access/access-control.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-control.ts#L145-L154) and [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L384-L407).
   * **Root Cause**: When `person.status !== "active"`, `evaluateAccess()` returns `reason: "face_no_match"`. Next.js saves `matchStatus: "matched"` + `reason: "face_no_match"` in `access_logs` and creates an `Alert` with `alertType: "unknown_face"`, `title: "Unknown Individual Detected"`, and `personId: matchedPerson.id`.

4. **Model Name Inconsistency (`buffalo_s` vs. `Buffalo_L`)**
   * **Evidence**: [`ai-service/app/core/config.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/core/config.py#L16) (`INSIGHTFACE_MODEL_NAME = "buffalo_s"`), [`frontend/prisma/schema.prisma`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/prisma/schema.prisma#L65) (`@default("buffalo_s")`), vs. [`frontend/app/dashboard/persons/[id]/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/persons/%5Bid%5D/page.tsx#L127) (`activeEmbedding?.modelName || "Buffalo_L"`).
   * **Impact**: Both models output 512-D embeddings, and `buffalo_s` is intentionally chosen to fit within 512MB RAM deployment limits, but fallback strings in UI/tests still say `"Buffalo_L"`.

5. **HNSW Vector Index Not Tracked in Prisma Migrations**
   * **Evidence**: [`frontend/scripts/apply-hnsw-index.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/scripts/apply-hnsw-index.ts#L1-L55) vs. [`frontend/prisma/schema.prisma`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/prisma/schema.prisma#L58-L74).
   * **Impact**: `face_embeddings_embedding_idx USING hnsw (embedding vector_cosine_ops)` is applied only if `scripts/apply-hnsw-index.ts` is manually executed.

---

## F. Prioritized Remediation Plan (P0, P1, P2, P3)

### P0 — Critical Security & Data Integrity Blockers

#### P0.1: Enforce Session Authentication on Unprotected Dashboard & Alert API Routes
* **Files**:
  * [`frontend/app/api/alerts/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/alerts/route.ts)
  * [`frontend/app/api/alerts/[id]/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/alerts/%5Bid%5D/route.ts)
  * [`frontend/app/api/dashboard/activity/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/dashboard/activity/route.ts)
  * [`frontend/app/api/dashboard/stats/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/dashboard/stats/route.ts)
  * [`frontend/app/api/dashboard/health/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/dashboard/health/route.ts)
* **Smallest Suitable Change**: Add `const session = await getServerSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });` at the start of each handler. In `PATCH /api/alerts/[id]`, also record `resolvedBy: session.user.id` when marking an alert resolved.
* **Dependencies**: Update unit tests in [`frontend/tests/dashboard.test.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/tests/dashboard.test.ts) to mock `getServerSession`.
* **Validation Test**: Verify unauthenticated requests to all 5 endpoints return `401 Unauthorized`, and authenticated `PATCH /api/alerts/[id]` sets `resolvedBy`.

#### P0.2: Record Security Alerts on Invalid/Unauthenticated Device Requests (Case 13)
* **Files**:
  * [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L34-L71)
* **Smallest Suitable Change**:
  1. Treat presence of `x-device-serial` or `x-device-api-key` header (even if empty string) strictly as a device request—never fall back to web session auth when device headers are present.
  2. When `authenticateDeviceRequest(request)` returns `authenticated: false`, persist an `Alert` (`alertType: "system_warning"`, `severity: "high"`, `title: "Unauthenticated Device Request Rejected"`) in PostgreSQL (wrapped in `try/catch` so DB errors don't mask the 401/403 response).
* **Dependencies**: None.
* **Validation Test**: Send `POST /api/access` with invalid `x-device-api-key` and verify `401` response + `Alert` creation.

#### P0.3: Fix Database / Vector Search Failure Classification so It Never Reports `"Unknown Individual"` (Case 12)
* **Files**:
  * [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L337-L482)
  * [`frontend/lib/access/access-client.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-client.ts#L86-L108)
  * [`frontend/app/dashboard/simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L255-L335)
* **Smallest Suitable Change**:
  1. In `POST /api/access`, wrap `findTopFaceMatches()` in a dedicated `try/catch` that logs an `AccessLog`/`Alert` (`reason: "system_error"`, `matchStatus: "error"`—best effort if DB is still partially reachable) and returns HTTP 500 with complete `AccessScanResponse` fields: `status: "recognition_error"`, `match_status: "error"`, `access_status: "denied"`, `reason: "system_error"`, `door_action: "keep_locked"`, `message: "VERIFICATION ERROR — Database or vector search failed."`.
  2. Ensure the outer `catch` in `route.ts` (line 467) also includes `status: "recognition_error"` and `match_status: "error"`.
  3. In `simulation/page.tsx`, check `response.reason === "system_error" || response.status === "recognition_error"` **before** checking `response.access_status === "denied"`, setting `overlayStatus = "error"`, `overlayText = "VERIFICATION ERROR"`, and recording `"System / Verification Error"` (with `matchStatus: "error"`) instead of `"Unknown Individual"` in the scan history.
* **Dependencies**: None.
* **Validation Test**: Mock `findTopFaceMatches` to throw a DB error in `tests/access.test.ts` and `tests/webcam-simulation.test.ts`; assert `status === "recognition_error"`, `match_status === "error"`, and that the UI never displays `"Unknown Individual"`.

---

### P1 — High-Priority Scenario Compliance Fixes (Cases 3, 6, 7, 11, 14, 15)

#### P1.1: Distinct Reason & Alert for Recognized but Unauthorized Individuals (Case 3)
* **Files**:
  * [`frontend/prisma/schema.prisma`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/prisma/schema.prisma#L189-L206)
  * [`frontend/lib/access/access-control.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-control.ts#L16-L25)
  * [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L384-L407)
  * [`frontend/app/api/access/logs/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/logs/route.ts#L8-L15)
  * [`frontend/components/dashboard/recent-access-table.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/components/dashboard/recent-access-table.tsx#L306-L310)
  * [`frontend/app/dashboard/access-logs/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/access-logs/page.tsx#L325-L331)
* **Smallest Suitable Change**:
  1. If avoiding a Prisma enum migration initially is preferred, or via a clean migration: add `unauthorized` (or `account_inactive`) to `AccessReason` in `schema.prisma` and `lib/access/access-control.ts`.
  2. In `evaluateAccess()` (`lib/access/access-control.ts` line 146), return `reason: "unauthorized"` when `matchStatus === "matched"` and `person.status !== "active"`.
  3. In `POST /api/access` (`route.ts`), when `accessDecision.reason === "unauthorized"`, create an `Alert` with `title: "Unauthorized Access Attempt"` and message identifying the deactivated/suspended person (`${matchedPerson.firstName} ${matchedPerson.lastName} (${matchedPerson.status})`), rather than `"Unknown Individual Detected"`.
  4. Update `RecentAccessTable` and `AccessLogsPage` to check `evt.reason === "unauthorized"` so historical logs remain accurate even if the person is later reactivated.
* **Dependencies**: Prisma migration (`npx prisma migrate dev`) if adding enum value to PostgreSQL.
* **Validation Test**: Test `evaluateAccess` and `POST /api/access` with `status: "inactive"` and `status: "suspended"`; verify `reason === "unauthorized"` and alert title `"Unauthorized Access Attempt"`.

#### P1.2: Fix Ambiguous Identity Match Status & Same-Person Multi-Embedding Bug (Case 7)
* **Files**:
  * [`frontend/lib/ai/face-recognition.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/face-recognition.ts#L81-L195)
  * [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L341-L416)
  * [`frontend/lib/access/access-client.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-client.ts#L10-L18)
  * [`frontend/app/dashboard/simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L240-L274)
* **Smallest Suitable Change**:
  1. In `findTopFaceMatches()`, deduplicate by `person_id` in SQL (`SELECT DISTINCT ON (fe.person_id) ... ORDER BY fe.person_id, (fe.embedding <=> $1::vector) ASC` wrapped in an outer query `ORDER BY cosine_distance ASC LIMIT $2`) so multiple embeddings of the same person never compete against each other.
  2. Add `"ambiguous_match"` to `AccessScanResponse["status"]` (`lib/access/access-client.ts`).
  3. In `POST /api/access` (`route.ts` line 341), set:
     ```ts
     const finalStatus =
       recognition.matchStatus === "matched"
         ? "known_individual"
         : recognition.matchStatus === "ambiguous"
         ? "ambiguous_match"
         : "unknown_individual";
     ```
* **Dependencies**: Update `tests/access.test.ts` and `tests/webcam-simulation.test.ts` where `status` on ambiguous match was asserted as `"unknown_individual"`.
* **Validation Test**: Unit test with 2 embeddings of the same person (`matchStatus === "matched"`) and 2 embeddings of different persons within `0.05` margin (`status === "ambiguous_match"`, `match_status === "ambiguous"`).

#### P1.3: Fix Face Quality Scoring Formula, Add Brightness Gate, and Unify Precheck (Case 6)
* **Files**:
  * [`ai-service/app/core/quality.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/core/quality.py#L22-L108)
  * [`ai-service/app/api/v1/endpoints/detect.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/api/v1/endpoints/detect.py#L46-L90)
  * [`ai-service/app/schemas/detection.py`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/ai-service/app/schemas/detection.py#L18-L35)
  * [`frontend/app/api/persons/precheck/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/persons/precheck/route.ts#L35-L71)
* **Smallest Suitable Change**:
  1. In `compute_face_quality()` (`ai-service/app/core/quality.py`), compute mean grayscale luminance on the face crop (`brightness = float(np.mean(gray_crop))`) and enforce hard minimum floors: if `sharpness_score < 0.20` (blurry), `size_score < 0.35` (face too small), or `brightness < 35.0 or brightness > 235.0` (too dark/overexposed), cap `composite_score` below `0.45` so it reliably triggers `poor_quality`.
  2. Compute and return `quality_score` in `/api/v1/detect` (`detect.py`), and update `/api/persons/precheck` (`precheck/route.ts`) to require `qualityScore >= 0.70` before reporting `"optimal"`.
* **Dependencies**: None.
* **Validation Test**: Pass a synthetically blurred (`cv2.GaussianBlur`) and a dark (`img * 0.1`) image to `compute_face_quality()` and verify `quality_score < 0.50`.

#### P1.4: Implement Repeated Denied Attempts Detection & Escalation (Case 15)
* **Files**:
  * [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L384-L465)
  * [`frontend/lib/access/access-client.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/access/access-client.ts#L10-L43)
  * [`frontend/app/dashboard/simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L255-L278)
* **Smallest Suitable Change**:
  1. When `accessDecision.accessStatus === "denied"` (for `face_no_match`, `unauthorized`, or `spoof_detected`), query `prisma.accessLog.count` for denied attempts on the same `deviceId` (or `deviceId: null` for web simulation) within the last `60` seconds.
  2. If `recentDeniedCount >= 3`:
     * Create or update a `high`/`critical` severity `Alert` titled `"Repeated Denied Access Attempts"` (and suppress duplicate `medium` alerts within the same 60s window to prevent DB spam).
     * Include `repeated_denial_Warning: true` (or update `message` to `"SECURITY ALERT — REPEATED DENIED ATTEMPTS"`) in `AccessScanResponse` so the simulation overlay / ESP32 OLED displays `"SECURITY ALERT — ACCESS DENIED"`.
* **Dependencies**: None.
* **Validation Test**: Simulate 3 consecutive unknown face scans within 60 seconds in `tests/access.test.ts` and assert that the 3rd scan triggers the escalated `"Repeated Denied Access Attempts"` alert and message.

#### P1.5: Persist Technical Failure Logs & Validate AI Service Responses (Cases 11 & 14)
* **Files**:
  * [`frontend/lib/ai/fastapi.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/lib/ai/fastapi.ts#L229-L263)
  * [`frontend/app/api/access/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L146-L176) and [`lines 258–294`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/route.ts#L258-L294)
* **Smallest Suitable Change**:
  1. In `analyzeImage()` (`lib/ai/fastapi.ts`), validate that when `result.status === "ready_for_recognition"`, `Array.isArray(result.embedding) && result.embedding.length === 512 && result.embedding.every(Number.isFinite)`. If not, throw `FastAPIError("Malformed embedding from AI service", 502, "AI_INVALID_RESPONSE")`.
  2. In `POST /api/access` (`route.ts` line 258), when `aiResult.status === "recognition_error"`, write an `AccessLog` (`matchStatus: "error"`, `accessStatus: "denied"`, `reason: "system_error"`) before returning `"PROCESSING FAILED — TRY AGAIN"`.
  3. Distinguish `FastAPIError` status codes in `route.ts` (lines 146–176): only create a `"FastAPI AI Service Unavailable"` (`device_offline`) alert when the service is unreachable/timed out (`502`/`503`/`504`), not when it returns `400 INVALID_IMAGE`.
* **Dependencies**: None.
* **Validation Test**: Mock `analyzeImage` returning `status: "recognition_error"` or a 128-length embedding; verify `AccessLog` creation with `reason: "system_error"` and overlay `"PROCESSING FAILED — TRY AGAIN"`.

---

### P2 — UI State Consistency & Secondary Workflow Fixes

#### P2.1: Fix Stale Result Card, Premature Snapshot Update, Bounding Box Clearing, and Network Catch in `WebcamSimulationPage`
* **Files**:
  * [`frontend/app/dashboard/simulation/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L145-L372) and [`line 565`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/simulation/page.tsx#L565)
* **Smallest Suitable Change**:
  1. Change line 565 from `isLoading={isScanning && !latestResult}` to `isLoading={isScanning}` (or clear/dim the previous badge while a new scan is in flight).
  2. In `overlayTimerRef` timeout callback (line 294), also clear `setDetectedPersons([])` and `setDetectedFaces([])` so bounding boxes don't freeze on the video feed.
  3. In `catch (err)` (line 363), set `cameraOverlay` to `{ status: "error", text: "SYSTEM UNAVAILABLE — TRY AGAIN", subtext: "Network or backend unreachable" }`, clear `detectedPersons`/`detectedFaces`, and update `latestResult` to a synthetic `recognition_error` state so a prior `"ACCESS GRANTED"` card is never left on screen during an outage.
* **Dependencies**: None.
* **Validation Test**: Simulate network rejection in `tests/webcam-simulation.test.ts` and verify `"SYSTEM UNAVAILABLE — TRY AGAIN"` overlay and cleared bounding boxes.

#### P2.2: Add Duplicate-Face Check to `PUT /api/persons/[id]/face` and Support `"suspended"` Status in UI
* **Files**:
  * [`frontend/app/api/persons/[id]/face/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/persons/%5Bid%5D/face/route.ts#L112-L162)
  * [`frontend/components/ai/person-modal.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/components/ai/person-modal.tsx)
* **Smallest Suitable Change**:
  1. Call `checkForDuplicateFace(embeddingResult.embedding, undefined, personId)` in `PUT /api/persons/[id]/face` before uploading to ImageKit.
  2. Add a `status` selector (`active`, `inactive`, `suspended`) in `PersonModal` when editing an existing person.
* **Dependencies**: None.
* **Validation Test**: Attempt to replace Person A's face with Person B's face and assert `409 DUPLICATE_PERSON`.

---

### P3 — Cleanup, Documentation & Future Hardware Readiness

#### P3.1: Remove or Deprecate Unused `POST /api/access/recognize` and Standardize Model Name (`buffalo_s`)
* **Files**:
  * [`frontend/app/api/access/recognize/route.ts`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/api/access/recognize/route.ts)
  * [`frontend/app/dashboard/persons/[id]/page.tsx`](file:///c:/Users/Michael%20Umoize/Desktop/Learning%20AI-ML/IntelliGuard/frontend/app/dashboard/persons/%5Bid%5D/page.tsx#L127)
* **Smallest Suitable Change**: Align fallback display strings from `"Buffalo_L"` to `"buffalo_s"` and either remove `/api/access/recognize` or have it delegate to the unified recognition logic.

---

## G. Hardware-Free Validation Plan

Because physical ESP32-S3-CAM, PIR, OLED, RGB LED, and buzzer hardware are not yet connected, every scenario (excluding Cases 8 & 9) can be validated in software using **Vitest integration tests + the Live Webcam Simulation page (`/dashboard/simulation`) + cURL/REST requests**:

| Scenario | Hardware-Free Software Validation Method | Expected Software Outcome |
| :--- | :--- | :--- |
| **Registration** | Enroll via `/dashboard/persons/register` using webcam with: (a) clear single face, (b) empty frame, (c) blurry/dark frame, (d) two faces in frame, (e) already-enrolled face. | (a) `201 Created` + 512-D vector in `face_embeddings`; (b) `422 NO_FACE_DETECTED`; (c) `422 POOR_QUALITY`; (d) `422 MULTIPLE_FACES`; (e) `409 DUPLICATE_PERSON`. |
| **Case 1 (Authorized)** | Scan registered `active` user in `/dashboard/simulation`. | `200 OK`, `status: "known_individual"`, `access_status: "granted"`, green `"ACCESS GRANTED"` overlay, approval chime, `AccessLog` row (`granted`, `face_matched`). |
| **Case 2 (Unknown)** | Scan unregistered person in `/dashboard/simulation`. | `200 OK`, `status: "unknown_individual"`, `access_status: "denied"`, red `"ACCESS DENIED — UNKNOWN FACE"` overlay, denial chime, `AccessLog` (`face_no_match`) + `Alert` (`unknown_face`). |
| **Case 3 (Unauthorized)** | Set registered user status to `inactive` or `suspended`, then scan in `/dashboard/simulation`. | `200 OK`, `status: "known_individual"`, `access_status: "denied"`, `reason: "unauthorized"`, red `"ACCESS DENIED — ACCOUNT INACTIVE"` overlay, `AccessLog` (`matched`, `unauthorized`) + `Alert` (`Unauthorized Access Attempt`). |
| **Case 4 (No Person)** | Point webcam at an empty wall/background and scan. | `200 OK`, `status: "no_person"`, neutral `"WAITING FOR PERSON"` overlay, no sound, **no** `AccessLog` or `Alert` created. |
| **Case 5 (No Face)** | Stand in front of webcam with face turned away or covered. | `200 OK`, `status: "no_face"`, amber `"FACE NOT DETECTED — PLEASE FACE CAMERA"` overlay, no sound, **no** `AccessLog` or `Alert` created. |
| **Case 6 (Poor Quality)** | Scan with defocused/motion-blurred frame, very dark lighting, or at far distance ($< 50$ px face). | `200 OK`, `status: "poor_quality"`, amber `"POOR IMAGE QUALITY — TRY AGAIN"` overlay, **no** `AccessLog` or `Alert` created. |
| **Case 7 (Ambiguous)** | Insert two synthetic embeddings within `< 0.05` cosine distance of the test face (for two different `person_id`s) and scan. | `200 OK`, `status: "ambiguous_match"`, `match_status: "ambiguous"`, `access_status: "denied"`, `"IDENTITY UNCERTAIN — TRY AGAIN"` overlay, `AccessLog` (`ambiguous`, `ambiguous_match`). |
| **Case 10 (Camera Failure)** | Revoke browser camera permission or unplug USB webcam during `/dashboard/simulation`. | `useWebcam` transitions to `error`, auto-scan halts, preview displays `"CAMERA ERROR"` state, no scan request sent. |
| **Case 11 (Backend/AI Down)** | Stop FastAPI server (`port 8000`) and scan in `/dashboard/simulation`; then stop Next.js server and scan. | `502` from Next.js (`"SYSTEM UNAVAILABLE — TRY AGAIN"` overlay, `AccessLog` with `system_error`); when Next.js is down, client catch shows `"SYSTEM UNAVAILABLE — TRY AGAIN"` and clears prior granted state. |
| **Case 12 (DB/Vector Failure)** | Temporarily point `DATABASE_URL` to an unreachable port or mock `findTopFaceMatches` failure. | `500` with `status: "recognition_error"`, `match_status: "error"`, `"VERIFICATION ERROR"` overlay, and **never** recorded as `"Unknown Individual"`. |
| **Case 13 (Invalid Device Auth)** | Send `POST /api/access` with `x-device-serial: ESP32-01` and `x-device-api-key: wrong-key`. | `401 Unauthorized`, no access granted, `Alert` recorded in DB. |
| **Case 14 (Timeout / Invalid AI)** | Inject artificial $>15\text{s}$ delay or malformed JSON in FastAPI `/api/v1/analyze`. | `502` / `recognition_error`, `"PROCESSING FAILED — TRY AGAIN"` overlay, `AccessLog` (`system_error`). |
| **Case 15 (Repeated Denials)** | Scan an unknown face 3+ times within 60 seconds in `/dashboard/simulation`. | 3rd scan escalates to `high`/`critical` `"Repeated Denied Access Attempts"` alert, suppresses duplicate medium alerts, and displays `"SECURITY ALERT — ACCESS DENIED"`. |

---

## H. Recommended Implementation Order

1. **Step 1 — Security & API Auth Hardening (P0.1 & P0.2)**: Lock down `/api/alerts`, `/api/alerts/[id]`, and `/api/dashboard/*` with `getServerSession()`, and log security alerts on failed `authenticateDeviceRequest` calls.
2. **Step 2 — Database Schema & Enum Alignment (P1.1)**: Add `unauthorized` to `AccessReason` (and `VALID_REASONS` in `/api/access/logs`) so deactivated/suspended users are cleanly separated from `face_no_match`.
3. **Step 3 — Vector Search Deduplication & Error Handling (P0.3 & P1.2)**: Update `findTopFaceMatches` (`lib/ai/face-recognition.ts`) to deduplicate by `person_id`, wrap vector search errors in `POST /api/access` so Case 12 returns `status: "recognition_error"` / `match_status: "error"`, and return `status: "ambiguous_match"` for Case 7.
4. **Step 4 — AI Quality Gate & Response Validation (P1.3 & P1.5)**: Fix `compute_face_quality()` in `ai-service/app/core/quality.py` (sharpness/size floors + brightness check), expose `quality_score` in `/api/v1/detect` for registration precheck parity, and validate 512-D embeddings + log `recognition_error` in `POST /api/access`.
5. **Step 5 — Repeated Denied Attempts Tracking (P1.4)**: Add sliding-window denial counting and alert escalation in `POST /api/access` for Case 15.
6. **Step 6 — Webcam Simulation UI Fixes (P2.1 & P2.2)**: Fix `WebcamSimulationPage` loading state, snapshot timing, bounding-box cleanup, network error overlay, and Case 12 scan-history labeling; add duplicate face check to `PUT /api/persons/[id]/face`.
7. **Step 7 — Automated Test Suite Verification**: Update and run Vitest tests across `frontend/tests/` and add FastAPI unit tests for `quality.py` and `analyze.py`.

---

## I. Questions and Uncertainties

Before we proceed to implementation, please clarify your preference on the following design choices:

1. **Case 3 (Authorization Granularity)**: Currently, the Prisma `Person` model only has `status` (`active`, `inactive`, `suspended`) and `category` (`Staff`, `Student`, `Visitor`, `Contractor`), with no location/door permission table. For Case 3, is checking `person.status === "active"` (and distinguishing `inactive`/`suspended` with a dedicated `unauthorized` reason and alert) sufficient for your current milestone, or do you also want per-device/per-location access permissions added to the database schema?
2. **Case 15 (Repeated Denied Attempts Thresholds)**: For repeated unknown/denied attempts, do you have specific threshold numbers in mind, or should we use **3 denied attempts within a 60-second rolling window** (per device / simulation source) to trigger a `high`-severity `"Repeated Denied Access Attempts"` alert and `"SECURITY ALERT"` OLED/overlay state?
3. **InsightFace Model (`buffalo_s` vs. `Buffalo_L`)**: The AI service and Prisma schema are configured to use `buffalo_s` (to stay within 512MB RAM deployment limits), whereas the specification overview and some UI fallback strings mention `Buffalo_L`. Should we keep `buffalo_s` as the runtime model and standardize the UI labels to match, or switch the local runtime configuration to `buffalo_l`?