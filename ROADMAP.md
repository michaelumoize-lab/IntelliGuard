# IntelliGuard Engineering Roadmap

This document outlines upcoming engineering enhancements, hardware integration tasks, and academic evaluation milestones for **IntelliGuard**.

---

## 1. Physical Hardware & Embedded Firmware (ESP32-S3-CAM)

- [ ] **Firmware Repository (`/firmware/esp32-s3-cam/`)**:
  - Implement C++/ESP-IDF firmware for Freenove / AI-Thinker ESP32-S3 CAM (OV5640).
  - Wi-Fi manager with captive portal configuration and reconnection watchdog.
- [ ] **Sensors & Actuator Control**:
  - **PIR Motion Sensor (HC-SR501 / AM312):** Configure GPIO external wake-up from Deep Sleep mode upon motion detection.
  - **Relay Mechanism:** Actuate 5V relay module on `{"door_action": "unlock"}` (pulse Normally Open for strike locks; release Normally Closed for magnetic locks).
  - **Visual & Audio Feedback:** Status RGB LED (Green: granted, Red: denied, Blue: scanning) and active buzzer chime.
- [ ] **Edge Device Security**:
  - Transmit multipart JPEG frame uploads with cryptographic verification headers (`X-Device-Id`, `X-Device-Key`, `X-Correlation-ID`).
  - Send periodic telemetry heartbeats (RSSI dBm, free heap, uptime) to `POST /api/devices/{id}/health`.
- [ ] **Protocol Optimization (MQTT over TLS)**:
  - Transition edge-to-backend messaging from HTTP polling to an MQTT micro-broker for sub-100ms bi-directional unlocks and emergency lockdowns.

---

## 2. Advanced Anti-Spoofing & Edge Vision

- [x] **Passive Software Liveness (Implemented)**:
  - Quantized MiniFASNetV2-SE ONNX model integrated into FastAPI `/analyze` pipeline.
  - Fail-closed denial (`spoof_detected`) on spoof confidence without database queries.
- [ ] **Hardware-Assisted Active Challenge-Response**:
  - Flash the ESP32 RGB LED in a pseudo-random color sequence during capture.
  - Verify matching chromatic illumination changes on facial landmarks to prevent high-resolution screen replays.
  - Multi-frame challenges (randomized blink or head-turn detection).
- [ ] **On-Device Face Pre-filtering (ESP-WHO / TFLite Micro)**:
  - Lightweight face presence detector running directly on ESP32-S3 PSRAM to avoid streaming empty frames over Wi-Fi.

---

## 3. Academic Benchmarking & Viva Defense Framework

- [ ] **Biometric Evaluation Suite (`/evaluation/`)**:
  - Standalone Python evaluation module (`scikit-learn`, `pandas`, `matplotlib`).
  - Calculate False Acceptance Rate (**FAR**) and False Rejection Rate (**FRR**) across similarity thresholds ($0.40$–$0.75$) using standard benchmark datasets (LFW, CelebA).
  - Compute Equal Error Rate (**EER**) and generate Receiver Operating Characteristic (**ROC**) curves for thesis documentation.
- [ ] **System Latency Profiling**:
  - Measure and plot latency breakdown:
    $$\Delta T_{\text{total}} = \Delta T_{\text{capture}} + \Delta T_{\text{upload}} + \Delta T_{\text{inference}} + \Delta T_{\text{vector\_search}} + \Delta T_{\text{actuation}}$$
  - Compare flat vector search vs. **HNSW index** query latency as the database scales from 10 to 50,000 vectors.
- [ ] **Load & Stress Testing**:
  - Automated Locust load test simulating 5–20 simultaneous door endpoints to measure p95/p99 response times and memory limits.
