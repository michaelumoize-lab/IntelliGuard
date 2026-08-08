# IntelliGuard

> **AI-Powered Intelligent Access Control & Security Monitoring System using ESP32-S3 CAM, InsightFace, Next.js, FastAPI, and PostgreSQL**

## Overview

**IntelliGuard** is an AI-powered intelligent access control and security monitoring system that combines **embedded systems, computer vision, artificial intelligence, web technologies, PostgreSQL, and IoT hardware** to provide real-time identity verification and security monitoring.

The system captures a person's face using a camera, sends the image to the application backend, and uses a dedicated **FastAPI AI service powered by InsightFace** to detect faces and generate facial embeddings.

The generated **512-dimensional facial embeddings** are compared against registered embeddings stored in **PostgreSQL with the pgvector extension**. Based on the recognition result, IntelliGuard determines whether access should be granted or denied and records the event for monitoring and auditing.

During software development, a **computer webcam** is used to simulate the physical camera. The **ESP32-S3 CAM with OV5640** will later replace the webcam as the physical image-capture device.

The ESP32 is intentionally not responsible for facial-recognition inference. Its primary responsibility is image capture, device communication, and hardware control based on the recognition result.

---

# Project Objectives

The main objectives of IntelliGuard are to:

- Develop an AI-powered facial recognition access-control system.
- Integrate an ESP32-S3 CAM into a networked security system.
- Generate and manage facial embeddings using InsightFace.
- Store facial embeddings using PostgreSQL and pgvector.
- Provide real-time identity verification.
- Record recognition and access-control events.
- Monitor connected IoT devices.
- Generate security alerts for suspicious or unauthorized activity.
- Provide a web-based administrative dashboard.
- Measure system performance and recognition accuracy.
- Demonstrate the integration of embedded hardware, networking, AI, databases, and web technologies.

---

# System Architecture

IntelliGuard consists of four major layers:

```text
┌──────────────────────────────────────────────────────────┐
│                    PHYSICAL LAYER                        │
│                                                          │
│  ESP32-S3 CAM                                            │
│       │                                                  │
│       ├── OV5640 Camera                                  │
│       ├── PIR Sensor                                     │
│       ├── OLED Display                                   │
│       ├── RGB LED                                        │
│       ├── Buzzer                                         │
│       └── Door/Lock Actuator                             │
└───────────────────────┬──────────────────────────────────┘
                        │
                   HTTP / HTTPS
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│                 APPLICATION LAYER                        │
│                                                          │
│                  Next.js Application                     │
│                                                          │
│       Frontend + API Routes + Business Logic             │
└───────────────┬─────────────────────────┬────────────────┘
                │                         │
                │                         │ HTTP
                │                         ▼
                │                ┌─────────────────────┐
                │                │   FastAPI AI Service │
                │                │                     │
                │                │     InsightFace     │
                │                │       OpenCV        │
                │                │    ONNX Runtime     │
                │                └──────────┬──────────┘
                │                           │
                │                    512D Embedding
                │                           │
                ▼                           │
┌──────────────────────────────────────────────────────────┐
│                    DATA LAYER                            │
│                                                          │
│                 PostgreSQL + pgvector                    │
│                                                          │
│  Persons │ Embeddings │ Devices │ Events │ Logs │ Alerts│
└──────────────────────────────────────────────────────────┘
```

---

# Responsibility of Each Layer

## Next.js Application

Next.js is the **main application and backend gateway**.

It is responsible for:

- Web frontend
- Authentication
- Authorization
- API routes
- Request validation
- Business logic
- Database operations
- Person management
- Device management
- Access-control decisions
- Recognition-event management
- Access logs
- Alerts
- System logs
- Communication with FastAPI
- Communication with ESP32 devices

The application uses **Next.js App Router Route Handlers** rather than a separate NestJS or Express backend.

---

## FastAPI AI Service

FastAPI is a dedicated AI and computer-vision service.

It is responsible for:

- Receiving images
- Image preprocessing
- Face detection
- Face alignment
- Face quality validation
- Facial embedding generation
- Face recognition
- Similarity calculations
- AI model inference
- Returning AI results to Next.js

FastAPI is **not the main application backend** and is not responsible for the application's primary database operations.

---

## InsightFace

InsightFace is the primary facial-recognition framework.

The current development environment uses the **Buffalo_L** model.

InsightFace is responsible for:

```text
Image
  ↓
Face Detection
  ↓
Face Alignment
  ↓
Face Recognition
  ↓
512D Embedding
```

The resulting embedding is returned to the Next.js backend, which handles persistence and application-level operations.

---

## PostgreSQL + pgvector

PostgreSQL is the primary application database.

The `pgvector` extension is used to store and search facial embeddings.

Facial embeddings are represented as:

```text
vector(512)
```

The database stores:

- Registered persons
- Facial embeddings
- Devices
- Recognition events
- Access logs
- Alerts
- System logs
- Authentication data

---

# Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React

## Main Application Backend

- Next.js App Router
- Next.js Route Handlers
- TypeScript
- Prisma
- PostgreSQL
- pgvector
- Zod
- Better Auth

## AI Service

- Python
- FastAPI
- InsightFace
- ONNX Runtime
- OpenCV
- NumPy
- Pillow
- python-multipart

## Database

- PostgreSQL
- Neon PostgreSQL
- Prisma ORM
- pgvector

## Hardware

### Primary Hardware

- ESP32-S3 CAM
- OV5640 Camera Module

### Sensors and Feedback

- HC-SR501 PIR Motion Sensor
- OLED Display
- KY-016 RGB LED
- KY-012 Active Buzzer

### Prototyping

- MB-102 Breadboard
- Jumper Wires

### Planned Access-Control Hardware

- Relay module
- Suitable low-voltage electronic lock/actuator

---

# Core System Workflow

## Face Registration

During development, a computer webcam is used to register a person.

```text
Computer Webcam
      │
      ▼
Capture Face Image
      │
      ▼
Next.js Frontend
      │
      ▼
Next.js API
      │
      ▼
FastAPI AI Service
      │
      ▼
InsightFace
      │
      ├── Detect Face
      ├── Validate Image
      └── Generate 512D Embedding
      │
      ▼
Embedding returned to Next.js
      │
      ▼
Prisma
      │
      ▼
PostgreSQL + pgvector
```

The frontend does **not** generate facial embeddings.

The FastAPI service performs AI inference.

The Next.js backend is responsible for storing the resulting embedding.

---

# Face Recognition

The recognition pipeline is:

```text
Camera
   │
   ▼
Capture Image
   │
   ▼
Next.js API
   │
   ▼
FastAPI
   │
   ▼
InsightFace
   │
   ├── Detect Face
   └── Generate Embedding
   │
   ▼
512D Embedding
   │
   ▼
Next.js
   │
   ▼
PostgreSQL + pgvector
   │
   ▼
Vector Similarity Search
   │
   ▼
Best Matching Person
   │
   ▼
Recognition Decision
   │
   ├── MATCHED
   ├── UNKNOWN
   ├── AMBIGUOUS
   └── REJECTED
   │
   ▼
Access Decision
   │
   ├── GRANTED
   └── DENIED
```

---

# ESP32-S3 CAM

The ESP32-S3 CAM acts primarily as an **image-capture and IoT control device**.

It does **not** run the InsightFace model.

Its responsibilities include:

- Connecting to Wi-Fi
- Capturing images using OV5640
- Sending images to the backend
- Receiving recognition results
- Reporting device status
- Communicating with sensors
- Controlling local feedback hardware

The computer webcam is used during software development so that the complete recognition pipeline can be built and tested before the physical ESP32 hardware is integrated.

---

# ESP32 Recognition Workflow

The planned physical workflow is:

```text
              Person approaches
                     │
                     ▼
                PIR Sensor
                     │
                     ▼
             ESP32-S3 CAM
                     │
                     ▼
              OV5640 Capture
                     │
                     ▼
              HTTP / HTTPS
                     │
                     ▼
               Next.js API
                     │
                     ▼
                FastAPI
                     │
                     ▼
               InsightFace
                     │
                     ▼
             pgvector Search
                     │
              ┌──────┴──────┐
              │             │
           MATCHED       UNKNOWN
              │             │
              ▼             ▼
          ACCESS          DENIED
           GRANTED
              │             │
        ┌─────┼─────┐       ├── Red LED
        │     │     │       └── Buzzer
        ▼     ▼     ▼
     Green  OLED  Lock
      LED
```

---

# Database Structure

The primary application entities are:

```text
User
Session
Account
Verification

Person
FaceEmbedding

Device

RecognitionEvent
AccessLog
Alert
SystemLog
```

## Person

Stores registered individuals.

Categories:

- Employee
- Student
- Visitor
- Contractor

Statuses:

- Active
- Inactive
- Suspended

---

## FaceEmbedding

Stores facial embeddings generated by InsightFace.

Important fields include:

- Person ID
- 512D embedding
- Embedding model
- Model version
- Image path
- Image hash
- Quality score
- Active status
- Creation timestamp

---

## Device

Stores connected IoT and security devices.

Examples:

- ESP32-S3 CAM
- Camera
- Access-control device
- Sensor

Device statuses:

- Online
- Offline
- Maintenance
- Error

---

## RecognitionEvent

Stores individual face-recognition attempts.

Information includes:

- Person
- Device
- Embedding
- Embedding distance
- Confidence score
- Match status
- Access decision
- Captured image
- Model name
- Model version
- Inference time
- Timestamp

---

## AccessLog

Stores access-control decisions.

Possible statuses:

- Granted
- Denied
- Pending
- Error

Reasons include:

- Face match
- Face no match
- Insufficient confidence
- Time restriction
- Invalid credentials
- System error
- Manual override

---

## Alert

Stores security and system alerts.

Examples:

- Unauthorized access
- Unknown face
- Device offline
- Suspicious activity
- System error
- Informational event

Alerts have severity levels:

- Low
- Medium
- High
- Critical

---

## SystemLog

Stores administrative and system activity.

Examples:

- Login
- Logout
- Create
- Update
- Delete
- Access granted
- Access denied
- Configuration change
- System start
- System stop

---

# Frontend

The frontend is implemented using Next.js.

## Public Pages

```text
/
```

The landing page contains:

- Hero
- Features
- How It Works
- System Architecture
- Technology Stack
- About
- GitHub
- Login

## Authentication

```text
/login
/register
```

## Dashboard

```text
/dashboard
```

The dashboard provides:

- Registered-person statistics
- Online-device statistics
- Recognition statistics
- Granted access
- Denied access
- Active alerts
- Recent recognition events
- Device status
- System activity

## Person Management

```text
/persons
/persons/register
/persons/[id]
```

Administrators can:

- View persons
- Search persons
- Filter persons
- Register people
- Capture registration images
- View person details
- Update information
- Deactivate persons
- Manage facial embeddings

## Recognition

```text
/recognition
/recognition/history
```

The recognition page allows webcam-based recognition testing before ESP32 integration.

## Access Logs

```text
/access-logs
```

Provides searchable and filterable access history.

## Alerts

```text
/alerts
```

Allows administrators to:

- View security alerts
- Filter alerts
- View alert details
- Resolve alerts

## Devices

```text
/devices
/devices/[id]
```

Displays:

- Device name
- Device type
- Location
- Status
- IP address
- Firmware version
- Last seen
- Device activity

## Users

```text
/users
```

Provides administrative user management.

## Settings

```text
/settings
```

Contains system and account configuration.

---

# API Architecture

Next.js Route Handlers provide the main REST API.

Example endpoints:

```text
GET    /api/persons
POST   /api/persons
GET    /api/persons/[id]
PATCH  /api/persons/[id]
DELETE /api/persons/[id]

GET    /api/devices
POST   /api/devices
GET    /api/devices/[id]
PATCH  /api/devices/[id]

POST   /api/recognition
GET    /api/recognition

GET    /api/access-logs

GET    /api/alerts
PATCH  /api/alerts/[id]

POST   /api/devices/[id]/heartbeat
```

The FastAPI service provides AI-specific endpoints.

Possible endpoints:

```text
POST /detect
POST /embedding
POST /recognize
```

The exact API structure may evolve during development.

---

# API Communication

The frontend communicates with the Next.js backend.

The Next.js backend communicates with FastAPI.

```text
┌──────────────┐
│   Frontend   │
└──────┬───────┘
       │
       ▼
┌────────────────────┐
│    Next.js API     │
│  Main API Gateway  │
└──────┬─────────────┘
       │
       ├──────────────► PostgreSQL
       │
       │
       └──────────────► FastAPI
                              │
                              ▼
                         InsightFace
```

The frontend does not directly access PostgreSQL.

The frontend does not directly generate embeddings.

The frontend normally does not directly communicate with the FastAPI service.

---

# Validation

Zod is used to validate incoming API requests.

```text
Request
   │
   ▼
Zod Validation
   │
   ▼
Business Logic
   │
   ▼
Prisma
   │
   ▼
PostgreSQL
```

Prisma provides database type safety, while Zod validates external input.

---

# Security Architecture

Security is an important part of IntelliGuard because the system controls physical access.

The application should:

- Authenticate protected users.
- Authorize administrative operations.
- Never expose database credentials to the browser.
- Never expose FastAPI secrets to the browser.
- Validate all external API input.
- Protect device credentials.
- Authenticate IoT devices.
- Use HTTPS in production.
- Validate timestamps and request freshness where required.
- Log important access-control operations.
- Avoid unnecessary storage of raw facial images.
- Protect facial embeddings as sensitive biometric data.

---

# Planned IoT Device Authentication

ESP32 devices should not be trusted solely because they know the API URL.

A planned security mechanism is:

```text
ESP32
   │
   ├── Device ID
   ├── Timestamp
   ├── Nonce
   ├── Image
   └── HMAC Signature
          │
          ▼
      Next.js API
          │
          ▼
    Verify Signature
          │
     ┌────┴────┐
     │         │
   Valid     Invalid
     │         │
     ▼         ▼
 Process     Reject
```

HMAC-SHA256 and per-device secrets may be implemented during the security-hardening phase.

---

# Liveness Detection

A future security enhancement is **liveness detection** to reduce the risk of someone presenting a photograph or screen containing an authorized person's face.

Potential approaches include:

- Blink detection
- Head movement
- Eye aspect ratio
- Challenge-response prompts
- Additional computer-vision checks

Liveness detection will be implemented only after the core face-recognition pipeline is stable.

---

# Power Efficiency

The ESP32 may eventually use the PIR sensor to avoid unnecessary image processing.

Potential workflow:

```text
Low-Power State
      │
      ▼
PIR Detects Motion
      │
      ▼
Wake ESP32
      │
      ▼
Capture Image
      │
      ▼
Send Image
      │
      ▼
Receive Result
      │
      ▼
Return to Low-Power State
```

This provides an opportunity to evaluate power consumption and IoT efficiency.

---

# Access-Control Hardware

The final physical prototype may include a relay-controlled access mechanism.

Example:

```text
Face Recognized
      │
      ▼
Access Granted
      │
      ▼
ESP32 GPIO
      │
      ▼
Relay
      │
      ▼
Electronic Lock
```

For safety and prototyping, the system should initially be tested using a low-voltage demonstration actuator rather than a real building door.

---

# Performance Benchmarking

A major objective of the project is to evaluate the performance of the complete system.

The following measurements will be collected:

### Latency

```text
Ttotal =
Tcapture +
Tnetwork_up +
Tinference +
Tvector_search +
Tnetwork_down +
Tactuation
```

Measurements may include:

- Image capture time
- Upload latency
- Face detection time
- Embedding generation time
- Vector search time
- API response time
- Hardware actuation time
- End-to-end recognition latency

### Recognition Metrics

The system may be evaluated using:

- Recognition accuracy
- Precision
- Recall
- False Acceptance Rate (FAR)
- False Rejection Rate (FRR)

Testing may be performed under different:

- Lighting conditions
- Face angles
- Distances
- Camera qualities
- Accessories such as glasses
- Environmental conditions

---

# Vector Search Benchmarking

The PostgreSQL `pgvector` implementation may also be evaluated.

The project can compare:

```text
Exact Vector Search
        vs
HNSW Vector Index
```

Metrics may include:

- Search latency
- Query performance
- Accuracy/recall
- Performance as the number of registered embeddings increases

This provides an additional database and systems-engineering component to the project.

---

# Development Roadmap

## Phase 1 — Project Foundation

- [x] Project structure
- [x] PostgreSQL database
- [x] Prisma schema
- [x] pgvector configuration
- [x] Database schema pushed to PostgreSQL
- [x] FastAPI project
- [x] InsightFace installation
- [x] InsightFace model download
- [x] Initial face detection test

## Phase 2 — Next.js Backend

- [ ] API response helpers
- [ ] Error handling
- [ ] Zod validation
- [ ] Authentication
- [ ] Authorization
- [ ] Person CRUD
- [ ] Device CRUD
- [ ] Recognition API
- [ ] Access Log API
- [ ] Alert API
- [ ] Device heartbeat API

## Phase 3 — AI Service

- [ ] FastAPI foundation
- [ ] InsightFace model setup
- [ ] Face detection test
- [ ] Face embedding generation
- [ ] Image quality validation
- [ ] Recognition service
- [ ] Similarity calculation
- [ ] Confidence threshold configuration

## Phase 4 — Face Registration

- [ ] Webcam capture
- [ ] Registration UI
- [ ] Image upload to Next.js
- [ ] Next.js → FastAPI communication
- [ ] Embedding generation
- [ ] Embedding returned to Next.js
- [ ] Embedding stored in PostgreSQL
- [ ] Registration success flow

## Phase 5 — Face Recognition

- [ ] Webcam recognition
- [ ] Image processing
- [ ] Embedding generation
- [ ] Vector similarity search
- [ ] Match determination
- [ ] Confidence calculation
- [ ] Recognition events
- [ ] Access decisions
- [ ] Access logs
- [ ] Alerts

## Phase 6 — Frontend

- [ ] Landing page
- [ ] Authentication pages
- [ ] Dashboard
- [ ] Person management
- [ ] Person registration
- [ ] Live recognition
- [ ] Recognition history
- [ ] Access logs
- [ ] Alerts
- [ ] Device management
- [ ] Settings

## Phase 7 — ESP32 Integration

- [ ] ESP32-S3 CAM setup
- [ ] OV5640 configuration
- [ ] Wi-Fi connection
- [ ] Image capture
- [ ] HTTP image upload
- [ ] Device authentication
- [ ] Backend response handling
- [ ] RGB LED integration
- [ ] Buzzer integration
- [ ] OLED integration
- [ ] PIR sensor integration

## Phase 8 — Access-Control Integration

- [ ] Relay module
- [ ] Demonstration lock/actuator
- [ ] Access-granted hardware response
- [ ] Access-denied hardware response
- [ ] Emergency/failure handling

## Phase 9 — Security Enhancements

- [ ] IoT device authentication
- [ ] HMAC request signing
- [ ] Timestamp/nonce validation
- [ ] HTTPS configuration
- [ ] Liveness detection
- [ ] Replay protection

## Phase 10 — Testing & Evaluation

- [ ] End-to-end testing
- [ ] AI recognition testing
- [ ] API testing
- [ ] Hardware testing
- [ ] Security testing
- [ ] Performance benchmarking
- [ ] FAR/FRR evaluation
- [ ] Latency evaluation
- [ ] Vector-search benchmarking
- [ ] Failure-condition testing

## Phase 11 — Deployment

- [ ] Production environment configuration
- [ ] Next.js deployment
- [ ] FastAPI deployment
- [ ] PostgreSQL production configuration
- [ ] Environment-variable configuration
- [ ] HTTPS
- [ ] ESP32 production configuration
- [ ] Final end-to-end deployment

---

# Development Environment

## Next.js

```text
http://localhost:3000
```

## FastAPI

```text
http://localhost:8000
```

## FastAPI Documentation

```text
http://localhost:8000/docs
```

## Database

PostgreSQL hosted using Neon during development.

---

# Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/IntelliGuard.git
cd IntelliGuard
```

---

## 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will run at:

```text
http://localhost:3000
```

---

## 3. Configure Frontend Environment Variables

Create:

```text
frontend/.env
```

Example:

```env
DATABASE_URL=your_postgresql_connection_string
BETTER_AUTH_SECRET=your_auth_secret
FASTAPI_URL=http://localhost:8000
```

Never commit `.env` files to Git.

---

## 4. FastAPI Setup

```bash
cd backend

python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Run FastAPI

```bash
uvicorn app.main:app --reload
```

The AI service will be available at:

```text
http://localhost:8000
```

---

# AI Dependencies

The FastAPI service currently uses:

```text
fastapi
uvicorn
insightface
onnxruntime
opencv-python
numpy
pillow
python-multipart
python-dotenv
```

The current InsightFace development environment uses the **Buffalo_L** model.

During development, inference currently runs using the **CPU execution provider**.

GPU acceleration may be considered later if required.

---

# Development Principles

IntelliGuard should prioritize:

1. Correct functionality
2. Clear architecture
3. Separation of responsibilities
4. Reliable facial recognition
5. Security
6. Maintainability
7. Good user experience
8. Measurable performance
9. Hardware-software integration
10. Avoiding unnecessary complexity

### Important Architectural Rules

- **Next.js is the main application backend.**
- Use **Next.js Route Handlers** for REST APIs.
- **Prisma** handles database access.
- **PostgreSQL** stores application data.
- **pgvector** stores facial embeddings.
- **FastAPI** handles AI and computer-vision operations.
- **InsightFace** handles face detection and embedding generation.
- The frontend does not directly access PostgreSQL.
- The frontend does not generate facial embeddings.
- FastAPI does not own the main application database.
- The ESP32 does not run InsightFace.
- The ESP32 primarily captures images and controls IoT hardware.
- **Zod** validates external API input.
- HTTP/HTTPS will be used for the initial ESP32 communication.
- MQTT may be evaluated as an alternative communication protocol but is not required for the initial implementation.
- Advanced features such as liveness detection and HMAC authentication should be added after the core system works.
- Do not introduce unnecessary frameworks or services unless they solve an actual project requirement.

---

# Current Project Status

**Version:** `v1.0.0-development`

The database schema and core project foundation have been established.

The InsightFace environment has been successfully configured and the **Buffalo_L** model has been downloaded and tested.

Initial face detection has been successfully completed using the CPU inference provider.

The immediate software milestone is:

```text
Webcam
   ↓
Capture Image
   ↓
Next.js API
   ↓
FastAPI
   ↓
InsightFace
   ↓
Generate 512D Embedding
   ↓
Return Embedding
   ↓
Next.js
   ↓
PostgreSQL / pgvector
```

After registration is working, the next milestone is complete webcam-based recognition.

Once the complete software workflow is stable, the computer webcam will be replaced by the **ESP32-S3 CAM + OV5640**.

The final goal is:

```text
Person
  ↓
PIR detects movement
  ↓
ESP32-S3 CAM
  ↓
OV5640 captures image
  ↓
Next.js API
  ↓
FastAPI
  ↓
InsightFace
  ↓
512D Embedding
  ↓
pgvector similarity search
  ↓
Recognition decision
  ↓
Access decision
  ↓
ESP32
  ↓
LED / OLED / Buzzer / Lock
```

---

# Author

**Michael Umoize**

Computer Engineering Student
AI & Machine Learning Enthusiast

---

# License

This project is licensed under the MIT License.
