# IntelliGuard

> **AI-Powered Intelligent Access Control & Security Monitoring System using ESP32-S3 CAM, InsightFace, Next.js, FastAPI, and PostgreSQL with pgvector**

IntelliGuard is an intelligent edge-to-cloud access control and security monitoring system. It pairs embedded IoT hardware (**ESP32-S3 CAM** with OV5640, simulated via computer webcam during development) with an **InsightFace (ArcFace 512D)** and **YOLOv8** microservice, using **PostgreSQL + pgvector** HNSW indexing for real-time identity verification and fail-closed physical security.

---

## Current Status

| Module | Status | Method / Technology |
| :--- | :--- | :--- |
| **Presentation Attack Detection (PAD)** | Working | Dual MiniFASNet Ensemble (V2 2.7x + V1SE 4.0x) ONNX Runtime |
| **Face Detection & Quality** | Working | SCRFD + Composite Quality Assessment (pose, blur, illumination) |
| **Person & Tailgating Detection** | Working | YOLOv8 Nano (`yolov8n.onnx`) with multi-person proximity & centroid tracking |
| **Facial Embedding** | Working | InsightFace ArcFace 512D (`buffalo_s` & `buffalo_l` dynamic runtime switching) |
| **Vector Similarity Search** | Working | PostgreSQL + `pgvector` HNSW Cosine Index (`<=>`) |
| **Access Decision Engine** | Working | Next.js API Gateway, Ambiguity Margin (`0.05`), Fail-Closed Guard |
| **Admin Dashboard & Management** | Working | Next.js App Router, PAD Inspector, Tailgating HUD, Prisma, ImageKit |
| **Edge Hardware Interface** | Ready | ESP32-S3 CAM (`POST /api/access` contract, PIR, Relay lock) |

**Test Results:** **70 passed, 0 failed** (57 AI service pytest + 13 Frontend integration test suites).

> 📘 **See [ANTISPOOFING.md](./ANTISPOOFING.md) for full Presentation Attack Detection architecture, mathematical formulations, and benchmarks.**

---

## Quick Start

### 1. Prerequisites
- **Node.js** `v20.x` or `v22.x`
- **Python** `3.10`–`3.14`
- **PostgreSQL 15+** with the `pgvector` extension enabled (e.g. Neon)

### 2. AI Service Setup (FastAPI)
```bash
cd ai-service
python -m venv .venv

# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Configure Biometric Model in .env:
# INSIGHTFACE_MODEL=buffalo_s (Default: ultra-fast MobileNet backbone, ~120MB RAM, 320x320 det size)
# INSIGHTFACE_MODEL=buffalo_l (High-accuracy: ResNet-50 backbone, 640x640 det size)
# (Note: Switching the model in .env triggers automatic live hot-reloading without service downtime!)

# Run AI test suite (57 tests covering detect, embedding, quality, PAD, tailgating)
pytest -v

# Start FastAPI service with automatic .env reload watching (port 8000)
python run.py
# Or via uvicorn CLI:
# uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-include .env
```

### 3. Frontend & Gateway Setup (Next.js)
```bash
cd frontend
npm install
cp .env.example .env.local
# Populate .env.local with DATABASE_URL, BETTER_AUTH_SECRET, FASTAPI_URL, IMAGEKIT keys

# Initialize database schema & apply migrations
# For an existing migration history:
npx prisma migrate deploy
# (For a fresh development database, run `npx prisma db push` or `npx prisma migrate dev`)

# Generate Prisma Client & apply pgvector HNSW index
npx prisma generate
npx tsx scripts/apply-hnsw-index.ts

# Run Frontend test suite (13 test suites)
npm test

# Start Next.js development server (port 3000)
npm run dev
```

---

## Project Structure

```text
IntelliGuard/
├── ai-service/                   # FastAPI AI microservice
│   ├── app/
│   │   ├── api/v1/               # Endpoints: /detect, /embedding, /analyze, /liveness, /health
│   │   ├── core/                 # InsightFace, YOLOv8, face quality assessment
│   │   └── schemas/              # Pydantic request/response schemas
│   ├── scripts/                  # Model benchmarking and validation scripts
│   └── tests/                    # Pytest test suite (55 tests)
├── frontend/                     # Next.js 14 Application & Access Gateway
│   ├── app/                      # App Router (Dashboard, Persons, Devices, Access Logs, API)
│   ├── components/               # UI components (shadcn/ui, Tailwind CSS)
│   ├── lib/                      # Prisma client, Better-Auth, ImageKit, access rules
│   ├── prisma/                   # Schema definitions & database migrations
│   ├── scripts/                  # HNSW index setup & test runners
│   └── tests/                    # 13 automated integration test suites
├── ARCHITECTURE.md               # Detailed architecture, workflows & hardware spec
└── README.md                     # Project documentation
```

---

## System Architecture

```text
┌─────────────────┐       HTTP Multipart       ┌──────────────────────┐
│  ESP32-S3 CAM   │ ─────────────────────────► │ Next.js API Gateway  │
│ (or Dev Webcam) │ ◄───────────────────────── │ (Rules, Auth, Logs)  │
└─────────────────┘       Door Action JSON     └──────────┬───────────┘
                                                          │
                                     ┌────────────────────┴────────────────────┐
                                     │ HTTP                                    │ SQL (pgvector)
                                     ▼                                         ▼
                          ┌─────────────────────┐                   ┌─────────────────────┐
                          │ FastAPI AI Service  │                   │ PostgreSQL Database │
                          │ InsightFace ArcFace │                   │ 512D Embeddings     │
                          │ YOLOv8 & SCRFD      │                   │ HNSW Cosine Index   │
                          └─────────────────────┘                   └─────────────────────┘
```

> For deep architectural documentation, see [ARCHITECTURE.md](ARCHITECTURE.md):
> - Component responsibilities and end-to-end workflows (Registration & Recognition)
> - ESP32-S3 CAM hardware HTTP payload contract & door action matrix (`unlock`, `lock`, `no_action`)
> - HNSW vector index topology (`m=16`, `ef_construction=64`, `ef_search=40`)
> - Fail-closed security rules and operational troubleshooting runbook

---

## Target Metrics

| Metric | Target | Current Status |
| :--- | :--- | :--- |
| **End-to-End Latency** | < 500ms | **~120–180ms** (capture to decision) |
| **Face Detection & Alignment** | < 50ms | **~25–40ms** (SCRFD CPU) |
| **ArcFace 512D Extraction** | < 100ms | **~45–70ms** (buffalo_s CPU) |
| **Vector Similarity Search** | < 10ms | **~2–5ms** (pgvector HNSW `<=>`) |
| **False Acceptance Rate (FAR)** | 0.00% | Cosine threshold `>= 0.50` + `0.08` ambiguity margin |
| **Hardware Fail-Safe** | 100% | Relays fail-closed (locked) on error or network drop |

---

## Author

**Michael Umoize**  
Final Year Computer Engineering Student  
AI & Machine Learning Enthusiast  

---

## License

This project's original source code is licensed under the [MIT License](LICENSE).  
Pre-trained model artifacts (InsightFace `buffalo_s` model zoo) are subject to [InsightFace's licensing terms](https://github.com/deepinsight/insightface#license) for non-commercial research use.
