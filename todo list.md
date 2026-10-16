# IntelliGuard — Project Roadmap & Next-Phase TODO List

This document tracks upcoming engineering enhancements for **IntelliGuard**, focusing on hardware deployment, advanced anti-spoofing security, and academic evaluation for the final-year capstone defense.

---

## Group C: Physical Hardware & Security Extensions

### 1. Physical ESP32-S3 Embedded Firmware & Edge Hardware
- [ ] **Create Firmware Subdirectory (`/firmware/esp32-s3-cam/`)**:
  - Implement Arduino C++ or ESP-IDF firmware for the **Freenove / AI-Thinker ESP32-S3 CAM (OV5640/OV2640)**.
- [ ] **Hardware Sensors & Actuators Integration**:
  - **PIR Motion Sensor (HC-SR501 / AM312):** Configure external GPIO interrupt to wake the ESP32 from Deep Sleep when motion is detected. *(Note: ~10 µA is bare ESP32-S3 silicon deep sleep; assembled dev boards typically draw 1–3 mA due to LDO regulators and camera sleep leakage, with the PIR sensor itself adding ~15–65 µA).*
  - **5V Relay Module:** Control power to physical locking mechanisms upon receipt of `{"door_action": "unlock"}`. Configure relay logic according to lock mechanism: pulse power ON for fail-secure solenoid door strikes (Normally Open / NO), or cut power OFF to release fail-safe electromagnetic locks (Normally Closed / NC).
  - **Auditory & Visual Feedback:** Drive status RGB LED (Green for granted, Red for denied, Blue for scanning) and active buzzer chimes.
- [ ] **Secure Microcontroller HTTP Client**:
  - Transmit multipart JPEG frame uploads over Wi-Fi with cryptographic replay headers:
    - `x-device-id`: Numeric ID of the enrolled device.
    - `x-api-key`: Raw cryptographic API key (`ig_dev_...`).
    - `x-timestamp`: Device Unix epoch seconds.
    - `x-nonce`: UUIDv4 or random 16-byte hex nonce per capture.
    - `x-signature`: Optional HMAC-SHA256 request payload signature.
- [ ] **Periodic Telemetry & Heartbeat Loop**:
  - Schedule background pings every 30–60 seconds to `POST /api/devices/{id}/health` sending live Wi-Fi RSSI (dBm), free heap RAM, and uptime seconds.
- [ ] **Optional: MQTT / TLS Micro-Broker**:
  - Transition edge-to-server messaging from HTTP polling to **Eclipse Mosquitto (MQTT over TLS)** for sub-100ms bi-directional door unlock commands and remote emergency overrides.

---

### 2. Face Anti-Spoofing & Liveness Detection Pipeline
- [x] **Passive Software Liveness Detection (Implemented)**:
  - Integrated quantized **MiniFASNetV2-SE** ONNX model into FastAPI `/analyze` pipeline.
  - Preprocesses face crops, normalizes inputs, checks SHA256 integrity, and inspects high-frequency texture and moiré cues before embedding generation.
- [x] **Access Engine & Schema Integration (Implemented)**:
  - Added `liveness_status`, `liveness_score`, and `liveness_time_ms` to API schemas.
  - Configured decision engine to immediately deny access (`spoof_detected`) on spoof confidence without querying pgvector, keeping doors locked.
- [ ] **Hardware-Assisted Active Challenge-Response (Future Enhancement)**:
  - Challenge the ESP32 to illuminate its onboard RGB LED in a pseudo-random color sequence (e.g., Green $\rightarrow$ Blue).
  - Verify matching chromatic illumination changes on the user's facial landmarks before authorizing entry.
  - Multi-frame challenge-response (interactive eye-blink and head-yaw tracking).

---

### 3. Biometric Evaluation Framework & Viva Defense Lab
- [ ] **Dedicated Academic Evaluation Suite (`/evaluation/`)**:
  - Create a standalone Python experimental module using `scikit-learn`, `pandas`, `numpy`, and `matplotlib`.
- [ ] **Biometric Accuracy & Threshold Curves**:
  - Evaluate False Acceptance Rate (**FAR**) and False Rejection Rate (**FRR**) across cosine similarity thresholds ($0.40$ to $0.75$) using standardized face datasets (e.g., LFW or CelebA).
  - Compute Equal Error Rate (**EER**) and generate Receiver Operating Characteristic (**ROC**) curves for thesis documentation.
- [ ] **System Benchmarking & Latency Profiling**:
  - Measure and graph latency breakdown:
    $$\Delta T_{\text{total}} = \Delta T_{\text{capture}} + \Delta T_{\text{upload}} + \Delta T_{\text{inference}} + \Delta T_{\text{vector\_search}} + \Delta T_{\text{actuation}}$$
  - Compare exact flat vector search vs. **HNSW index** query times as database scales from 10 to 50,000 vectors.
- [ ] **Stress & Concurrency Load Testing**:
  - Build a **Locust** load test simulating 5 to 20 physical doors making simultaneous access verification requests to measure p95/p99 response times and verify container resource consumption.
