# IntelliGuard System Architecture

> **AI-Powered Intelligent Access Control & Security Monitoring System**
>
> Architecture & End-to-End Workflow Specification

---

## 1. System Overview & Layered Architecture

IntelliGuard is structured into four distinct physical and logic layers:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          1. PHYSICAL LAYER                             │
│                                                                        │
│  ESP32-S3 CAM                                                          │
│  ├── OV5640 Camera Module (Image Capture)                             │
│  ├── PIR Motion Sensor (HC-SR501)                                      │
│  ├── RGB LED & Active Buzzer (Visual & Audible Feedback)                │
│  ├── OLED Display (Status Messages)                                    │
│  └── Door Lock / Actuator Relay                                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                               HTTP │ Photo Upload & Control Response
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        2. APPLICATION LAYER                            │
│                                                                        │
│  Next.js Application (Main Gateway & Controller)                       │
│  ├── Web Frontend & Administrative Dashboard                           │
│  ├── Next.js App Router API Handlers                                   │
│  ├── Person & Device Management Business Logic                         │
│  ├── Access Authorization & Rule Evaluation                            │
│  ├── Event Logging & Security Alerts Triggering                        │
│  └── Next.js ◄──► FastAPI AI Communication                             │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │                                        │
      SQL /     │ 512D Vector Search                     │ HTTP
      Prisma    │ & Record Queries                       ▼
                │                       ┌────────────────────────────────┐
                │                       │      3. FASTAPI AI SERVICE     │
                │                       │                                │
                │                       │  InsightFace (Buffalo_L)       │
                │                       │  ├── Face Detection (SCRFD)    │
                │                       │  ├── Landmark Alignment        │
                │                       │  └── 512D ArcFace Embedding    │
                │                       └────────────────────────────────┘
                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           4. DATA LAYER                                │
│                                                                        │
│  PostgreSQL + pgvector                                                 │
│  ├── Person Records & Metadata                                         │
│  ├── 512D Facial Embeddings (`vector(512)`)                            │
│  ├── Native `pgvector` Cosine Similarity Search (`<=>`)                │
│  ├── Registered Devices & Status                                       │
│  └── Access Logs, Alerts, & System Logs                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibilities

| Component | Primary Responsibility | Does NOT Do |
| :--- | :--- | :--- |
| **ESP32-S3 CAM** | Motion sensing, photo capture, HTTP communication, local hardware feedback (LED, buzzer, OLED, relay). | Does **NOT** run AI models or store database records. |
| **Next.js Backend** | Primary application gateway, admin dashboard, business logic, access decision evaluation, calling FastAPI, issuing database queries, logging events. | Does **NOT** generate facial embeddings directly. |
| **FastAPI AI Service** | Stateless AI microservice. Performs face detection, quality scoring, and 512D ArcFace embedding generation using InsightFace (`Buffalo_L`). | Does **NOT** connect to PostgreSQL or manage user authentication. |
| **PostgreSQL + `pgvector`** | Primary database persistence. Executes vector similarity search (`<=>` cosine distance) directly in-engine using indexed HNSW/IVFFlat vector indexes. | Does **NOT** make business access control decisions. |

---

## 3. Workflow 1: Person Registration

Person enrollment is initiated by an administrator via the Next.js Web Interface.

```text
Admin Web Interface (Next.js Frontend)
      │
      ├── 1. Enter Person Details (Name, Role, Department)
      ├── 2. Capture / Upload Face Photo
      │
      ▼
Next.js API Route Handler
      │
      ├── 3. Receive registration payload
      ├── 4. Send photo to FastAPI (`POST /api/v1/embedding`)
      │
      ▼
FastAPI AI Microservice
      │
      ├── 5. Decode image with OpenCV (`cv2.imdecode`)
      ├── 6. Run InsightFace (`Buffalo_L`) face detection
      ├── 7. Validate face count (MUST be exactly 1 face)
      ├── 8. Extract 512D L2-normalized ArcFace embedding
      ├── 9. Evaluate composite face quality score
      ├── 10. Return 512D vector JSON to Next.js
      │
      ▼
Next.js Application Backend
      │
      ├── 11. Receive 512D embedding vector
      ├── 12. Write `Person` record to PostgreSQL via Prisma
      └── 13. Write `FaceEmbedding` (`vector(512)`) record to PostgreSQL
      │
      ▼
Database Persistence (PostgreSQL + pgvector)
```

---

## 4. Workflow 2: Face Recognition & Access Control

The physical door access workflow executes when a person approaches an ESP32-S3 CAM endpoint.

```text
Person approaches door endpoint
      │
      ▼
HC-SR501 PIR Motion Sensor triggers
      │
      ▼
ESP32-S3 CAM captures photo (OV5640)
      │
      ▼
ESP32 sends HTTP POST (image bytes) to Next.js (`/api/recognition`)
      │
      ▼
Next.js API Handler forwards image to FastAPI (`POST /api/v1/embedding`)
      │
      ▼
FastAPI AI Service generates 512D embedding vector using InsightFace (`Buffalo_L`)
      │
      ▼
FastAPI returns 512D embedding vector to Next.js
      │
      ▼
Next.js queries PostgreSQL with `pgvector`:
`SELECT person_id, 1 - (embedding <=> query_vec) AS similarity FROM "FaceEmbedding" ORDER BY embedding <=> query_vec LIMIT 1;`
      │
      ▼
PostgreSQL + `pgvector` performs vector cosine similarity search in database engine
      │
      ▼
PostgreSQL returns best matching `Person` and similarity score to Next.js
      │
      ▼
Next.js evaluates Access Rules:
  ├── Is similarity >= Threshold (e.g., 0.60)?
  ├── Is the Person active & permitted at this door/time?
  └── Is the Device registered and active?
      │
      ├── MATCHED + PERMITTED  ──► Access Decision: GRANTED
      └── UNKNOWN / UNMATCHED  ──► Access Decision: DENIED
      │
      ▼
Next.js logs event to PostgreSQL (`AccessLog` & `Alerts` if unauthorized)
      │
      ▼
Next.js returns JSON response to ESP32: `{ "status": "GRANTED", "person": "John Doe" }`
      │
      ▼
ESP32 Hardware Reaction:
  ├── GRANTED : Relay unlocks door + Green LED + Chime + OLED "Welcome John Doe"
  └── DENIED  : Relay locked + Red LED + Alarm Buzzer + OLED "ACCESS DENIED"
```

---

## 5. Primary Database Entities

```text
User ──────────────► Auth & Administrative Web Access
Person ────────────► Registered Individuals (Name, Role, Status)
FaceEmbedding ─────► Biometric 512D Vectors (`vector(512)`) linked to Person
Device ────────────► ESP32-S3 CAM Hardware Endpoints (MAC, IP, Status)
AccessLog ─────────► Audit Log of Recognition & Entry Events
Alert ─────────────► Security Alerts triggered on Unauthorized / Ambiguous Access
```

---

## 6. Biometric Security Principles

1. **Stateless AI Engine**: FastAPI performs pure memory-based inference and never holds persistent biometric databases or client credentials.
2. **Sensitive Biometric Storage**: 512-dimensional facial embeddings are sensitive biometric identifiers. They are stored securely in PostgreSQL + `pgvector` and are never exposed in raw vector form to client UI components or public API logs.
