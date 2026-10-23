# IntelliGuard AI Service (Buffalo_L Model Pack)

> **High-Accuracy Local Biometric Inference Service using SCRFD-10G Detection & ResNet-50 ArcFace 512D Embeddings**

This microservice is the **`buffalo_l`** variant of IntelliGuard's computer vision pipeline. It is optimized for high-accuracy local execution on modern desktop/laptop hardware, complementing the cloud container service (`ai-service` with `buffalo_s`).

---

## Model Architecture Comparison

| Characteristic | `ai-service` (Buffalo_S) | `ai-service-buffalo-l` (Buffalo_L) |
| :--- | :--- | :--- |
| **Primary Target** | Render Free Tier (512MB RAM) | Local Workstation / Laptop / GPU Server |
| **Face Detector** | **SCRFD-500M** (lightweight) | **SCRFD-10G** (deep receptive field, 10G FLOPs) |
| **Feature Extractor** | **MobileFaceNet** (`w600k_mbf`, ~1.2M params) | **ResNet-50** (`w600k_r50`, ~43.6M params) |
| **Detection Resolution** | $320 \times 320$ px | $640 \times 640$ px |
| **RAM Footprint** | ~140 MB | ~500–600 MB |
| **Invariance** | High for frontal angles | Superior for pose angles, accessories, low light |
| **Default Port** | `8000` | `8001` |

---

## Quick Start (Local Windows / PowerShell)

### 1. Activate Environment
You can reuse the virtual environment from `ai-service` or create a new one:

```powershell
# Using the existing virtual environment:
..\ai-service\.venv\Scripts\Activate.ps1

# Or create a dedicated venv:
# python -m venv .venv
# .\.venv\Scripts\Activate.ps1
# pip install -r requirements.txt
```

### 2. Verify Buffalo_L Model Weights
Ensure all ONNX weights load properly into memory:

```powershell
python scripts/verify_model.py
```

### 3. Run Side-by-Side Model Comparison
Compare `buffalo_s` and `buffalo_l` performance, memory, and detection on an image:

```powershell
python scripts/compare_models.py --image test.jpg
```

### 4. Run Pytest Suite (33 Tests)
```powershell
pytest -v
```

### 5. Launch the FastAPI Service on Port 8001
```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Interactive OpenAPI Swagger documentation will be available at:
👉 **`http://localhost:8001/docs`**

---

## Connecting Next.js Frontend to Buffalo_L

To route the Next.js access gateway to this high-accuracy `buffalo_l` instance:

1. Open `frontend/.env.local`
2. Update the `FASTAPI_URL` variable:
   ```env
   FASTAPI_URL="http://localhost:8001"
   ```
3. Restart Next.js:
   ```powershell
   npm run dev
   ```

> **Important Reminder on Vector Spaces:**
> Biometric vectors extracted with `buffalo_s` and `buffalo_l` are mathematically incompatible. When switching models, re-enroll identities via the registration UI or use a distinct test database so cosine similarity distances evaluate accurately.
