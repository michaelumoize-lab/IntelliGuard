# IntelliGuard — Facial Presentation Attack Detection (PAD) & Anti-Spoofing Architecture

## 1. Executive Summary

IntelliGuard integrates a production-grade, dual-model **Facial Presentation Attack Detection (PAD)** system based on the open-source [yakhyo/face-anti-spoofing](https://github.com/yakhyo/face-anti-spoofing) implementation (derived from Silent-Face-Anti-Spoofing, Apache-2.0). 

The anti-spoofing engine acts as a **fail-closed biometric gatekeeper**: before any detected face is passed to InsightFace ArcFace for 512D biometric embedding generation, it must be verified as a bona fide live human face. If a presentation attack (such as a smartphone screen photo replay, printed paper photo, or cut-out mask) is detected, the pipeline immediately halts recognition, sets `embedding = None`, locks the access relay, records a security audit log with `reason: "spoof_detected"`, and generates a high-severity security alert.

---

## 2. Model Architecture & Provenance

The system ensembles two complementary multi-scale convolutional neural networks executed entirely in **ONNX Runtime (CPU Execution Provider default, CUDA optional)** without PyTorch runtime overhead:

| Model | Input Shape | BGR Crop Scale | Squeeze & Excitation (SE) | Primary Sensitivity |
| :--- | :--- | :--- | :--- | :--- |
| **MiniFASNetV2** | `[1, 3, 80, 80]` | **2.7x** | No | Skin reflection, specular highlights, fine facial contour boundaries |
| **MiniFASNetV1SE** | `[1, 3, 80, 80]` | **4.0x** | **Yes (Channel Attention)** | Peripheral context, smartphone screen bezels, moiré patterns, paper boundaries |

### Provenance & License
- **Reference Repository:** [yakhyo/face-anti-spoofing](https://github.com/yakhyo/face-anti-spoofing)
- **License:** Apache License 2.0
- **Official Model Weights:**
  - `MiniFASNetV2.onnx`: SHA256 `b32929adc2d9c34b9486f8c4c7bc97c1b69bc0ea9befefc380e4faae4e463907`
  - `MiniFASNetV1SE.onnx`: SHA256 `ebab7f90c7833fbccd46d3a555410e78d969db5438e169b6524be444862b3676`
- **Integrity Validation:** Model files are verified against SHA256 checksums upon startup.

---

## 3. Mathematical Preprocessing & Dynamic Crop Scaling

Anti-spoofing models require **contextual crops** from the **original unaligned BGR image** rather than normalized 112×112 ArcFace alignment crops. The contextual crop captures ambient light reflection and attack artifacts.

### Boundary-Aware Dynamic Scale Formula
To prevent cropping out-of-bounds when a face is close to the image perimeter, IntelliGuard implements dynamic boundary scaling:

$$\text{eff\_scale} = \min\left(\frac{H_{\text{img}} - 1}{H_{\text{box}}}, \frac{W_{\text{img}} - 1}{W_{\text{box}}}, \text{target\_scale}\right)$$

Where:
- $\text{target\_scale} = 2.7$ for MiniFASNetV2
- $\text{target\_scale} = 4.0$ for MiniFASNetV1SE

The expanded crop coordinates centered at $(\text{center}_x, \text{center}_y)$ are:

$$x_{1,\text{crop}} = \max\left(0, \text{round}(\text{center}_x - \frac{W_{\text{new}}}{2})\right)$$
$$y_{1,\text{crop}} = \max\left(0, \text{round}(\text{center}_y - \frac{H_{\text{new}}}{2})\right)$$
$$x_{2,\text{crop}} = \min\left(W_{\text{img}} - 1, \text{round}(\text{center}_x + \frac{W_{\text{new}}}{2})\right)$$
$$y_{2,\text{crop}} = \min\left(H_{\text{img}} - 1, \text{round}(\text{center}_y + \frac{H_{\text{new}}}{2})\right)$$

The cropped BGR region is resized to `(80, 80)` using bilinear interpolation (`cv2.INTER_LINEAR`), transposed to CHW layout `[1, 3, 80, 80]` float32 in raw `[0, 255]` range, and evaluated.

### Logit Softmax & Class Interpretation
The model outputs logits across 3 classes:
- **Class 0:** 2D Presentation Attack (Printed Photo / Digital Screen)
- **Class 1:** **Bona Fide Genuine Human Face (Live)**
- **Class 2:** Other Presentation Attacks (e.g. 3D Masks)

Numerically stable softmax is computed as:

$$P(\text{class}_i) = \frac{e^{z_i - \max(\mathbf{z})}}{\sum_j e^{z_j - \max(\mathbf{z})}}$$

The bona fide confidence score is $P(\text{class}_1)$.

---

## 4. Dual-Model Ensemble Fusion & Tri-State Decision Logic

Both networks evaluate the face independently. Their genuine scores are combined via **mean class-score fusion**:

$$S_{\text{ensemble}} = \frac{P_{\text{V2}}(\text{class}_1) + P_{\text{V1SE}}(\text{class}_1)}{2}$$

```
                ┌─────────────────────────────────┐
                │   Ensemble Score (S_ensemble)   │
                └─────────────────────────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
    S_ensemble >= 0.80     0.45 < S < 0.80      S_ensemble <= 0.45
     ┌───────────┐         ┌──────────────┐      ┌─────────────────┐
     │   LIVE    │         │ INCONCLUSIVE │      │ SPOOF DETECTED  │
     └─────┬─────┘         └──────┬───────┘      └────────┬────────┘
           │                      │                       │
      Continue to            Request retry          Lock relay, log
     ArcFace 512D              No unlock             security alert,
      Recognition            embedding=None          fail-closed 403
```

### Tri-State Outcomes:
1. **`LIVE` ($S \ge 0.80$):**
   - High-confidence bona fide human presentation.
   - Eligible to proceed to ArcFace 512D embedding extraction and pgvector identity matching.
2. **`SPOOF_DETECTED` ($S \le 0.45$):**
   - Confirmed presentation attack.
   - `embedding = None` (fail-closed guard).
   - Relays locked, AccessLog `reason: "spoof_detected"`, and high-severity Security Alert recorded.
3. **`INCONCLUSIVE` ($0.45 < S < 0.80$):**
   - Marginal confidence or conflicting models.
   - User is prompted to reposition and look directly at the camera under clear lighting.
   - Door remains locked; no security accusation is made against the user.
4. **`ERROR`:**
   - Model offline or image decoding failure. Fails closed with 500 status.

---

## 5. Architectural Independence: `buffalo_s` and `buffalo_l` Compatibility

The anti-spoofing engine operates upstream of ArcFace and is completely decoupled from the recognition model pack.

IntelliGuard supports both configurations via `INSIGHTFACE_MODEL`:

```bash
# Lightweight edge / low-memory deployment (MobileFaceNet, 512MB RAM safe):
INSIGHTFACE_MODEL=buffalo_s

# High-accuracy enterprise deployment (ResNet-50 w600k_r50):
INSIGHTFACE_MODEL=buffalo_l
```

### Biometric Template Safety
`buffalo_s` (MobileFaceNet) and `buffalo_l` (ResNet-50) generate non-interchangeable 512D embeddings. IntelliGuard prevents cross-model comparison through strict database version tagging in `frontend/lib/ai/face-recognition.ts`:

```sql
WHERE fe.is_active = true
  AND LOWER(fe.embedding_model) = LOWER($3)
```

Enrolled embeddings created under `buffalo_s` are never silently compared against queries under `buffalo_l`. Both configurations share the exact same MiniFASNet dual-ensemble PAD engine.

---

## 6. End-to-End Pipeline & Security Gatekeeping

```text
1. Client Input (Browser Webcam / ESP32-S3 CAM / Mobile Upload)
   │
2. Image Decoding & Quality Pre-Check (Dimensions, Blur, Illumination)
   │
3. YOLOv8 Person Detection (Verify Human Body Presence)
   │
4. SCRFD Face Detection & Pose Evaluation (Pitch, Yaw, Roll <= 30°)
   │
5. [SECURITY GATE] MiniFASNetV2 (2.7x) + MiniFASNetV1SE (4.0x) Dual PAD Check
   ├─► SPOOF DETECTED: Set embedding=None -> Door Lock -> Security Alert -> 403
   ├─► INCONCLUSIVE: Set embedding=None -> Door Lock -> Retry Prompt
   └─► LIVE (Bona Fide):
        │
6. ArcFace 512D L2-Normalized Embedding Extraction
   │
7. PostgreSQL + pgvector Cosine Distance Search (<=>)
   │
8. Decision Engine (Face Match, Ambiguity Margin, Active/Suspended Status)
   │
9. AccessLog Audit Trail & Relay Actuation (Unlock for 60s)
```

### Enrollment Gatekeeper (`POST /api/v1/embedding`)
Presentation attack detection is strictly enforced during face registration. If an administrator or user attempts to register a person using a photograph of a screen or printed card, the service rejects the request with **HTTP 400 Bad Request** (`Face registration rejected: Presentation attack / spoof detected...`). This prevents malicious injection of spoofed templates into the database.

---

## 7. Verification & Biometric Performance Benchmark

### Evaluation Script
Run the ISO/IEC 30107-3 compliant evaluation utility:

```bash
# Run on default test image:
ai-service/.venv/Scripts/python.exe ai-service/scripts/evaluate_liveness.py

# Run on custom datasets:
python ai-service/scripts/evaluate_liveness.py --genuine-dir /path/to/genuine --spoof-dir /path/to/spoofs
```

### Benchmark Results on `michael.JPG`:
```text
=================================================================
   IntelliGuard Face Anti-Spoofing / PAD Evaluation
   Dual Ensemble: MiniFASNetV2 (2.7x) + MiniFASNetV1SE (4.0x)
=================================================================

Testing image: michael.JPG (1242x1304)
-----------------------------------------------------------------
Verdict:            LIVE
Bona Fide Score:    0.9975 (99.75%)
Operational Range:  Live >= 0.80 | Spoof <= 0.45
MiniFASNetV2 (2.7): 0.9957
MiniFASNetV1SE(4.0):0.9993
Ensemble Fusion:    mean
Inference Latency:  33.25 ms (CPU)
-----------------------------------------------------------------
```

### Automated Pytest Suite:
```bash
ai-service/.venv/Scripts/python.exe -m pytest ai-service/tests/test_anti_spoofing.py -v
```
**Results:** **22 passed, 0 failed** in 28.43s across:
- Standard scale (2.7x) and wide scale (4.0x) crops
- Boundary clipping at origin `(0, 0)` and image limits `(W, H)`
- Degenerate/inverted bounding box error handling
- Softmax numerical overflow and underflow tests
- SHA256 checksum integrity verification
- Tri-state threshold classification (`live`, `spoof_detected`, `inconclusive`)
- Fail-closed gatekeeper ensuring `embedding = None` on spoof
- Dedicated FastAPI endpoints (`POST /api/v1/liveness` & `/base64`)

---

## 8. Frontend Inspector & UI Navigation

IntelliGuard provides a dedicated administrator inspection dashboard at `/dashboard/liveness`:
- Direct drag-and-drop / file upload testing
- Live bona fide confidence meters
- Individual model breakdown (MiniFASNetV2 vs. MiniFASNetV1SE)
- Telemetry readout (CPU latency, crop scale factors, model provenance)
- Accessible directly from the main sidebar under **"Anti-Spoofing (PAD)"**.
