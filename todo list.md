# IntelliGuard — Project Roadmap & Next-Phase TODO List

This document tracks upcoming engineering enhancements for **IntelliGuard**, focusing on hardware deployment, advanced anti-spoofing security, and academic evaluation for the final-year capstone defense.

---

## Group C: Physical Hardware & Security Extensions

### 1. Physical ESP32-S3 Embedded Firmware & Edge Hardware
- [ ] **Create Firmware Subdirectory (`/firmware/esp32-s3-cam/`)**:
  - Implement Arduino C++ or ESP-IDF firmware for the **Freenove / AI-Thinker ESP32-S3 CAM (OV5640/OV2640)**.
- [ ] **Hardware Sensors & Actuators Integration**:
  - **PIR Motion Sensor (HC-SR501):** Configure external GPIO interrupt to wake the ESP32 from Deep Sleep ($\sim 10\,\mu\text{A}$) only when motion is detected.
  - **5V Relay Module:** Trigger GPIO high/low to pulse power to a 12V solenoid door strike or magnetic lock upon receipt of `{"door_action": "unlock"}`.
  - **Auditory & Visual Feedback:** Drive status RGB LED (Green for granted, Red for denied, Blue for scanning) and active buzzer chimes.
- [ ] **Secure Microcontroller HTTP Client**:
  - Transmit multipart JPEG frame uploads over Wi-Fi with cryptographic replay headers:
    - `x-device-id`: Numeric ID of the enrolled device.
    - `x-api-key`: Raw cryptographic API key (`ig_dev_...`).
    - `x-timestamp`: Device Unix epoch seconds.
    - `x-nonce`: UUIDv4 or random 16-byte hex nonce per capture.
- [ ] **Periodic Telemetry & Heartbeat Loop**:
  - Schedule background pings every 30–60 seconds to `POST /api/devices/{id}/health` sending live Wi-Fi RSSI (dBm), free heap RAM, and uptime seconds.
- [ ] **Optional: MQTT / TLS Micro-Broker**:
  - Transition edge-to-server messaging from HTTP polling to **Eclipse Mosquitto (MQTT over TLS)** for sub-100ms bi-directional door unlock commands and remote emergency overrides.

---

### 2. Face Anti-Spoofing & Liveness Detection Pipeline
- [ ] **Passive Software Liveness Detection**:
  - Integrate a dedicated anti-spoofing neural network (e.g., **Silent-Face-Anti-Spoofing** / **MiniFASNet**) into the FastAPI AI service.
  - Inspect texture patterns, specular reflections, and moiré screen distortion to distinguish physical 3D human faces from printed photographs or smartphone/tablet screens.
- [ ] **Hardware-Assisted Active Challenge-Response**:
  - Have the backend challenge the ESP32 to illuminate its onboard RGB LED in a pseudo-random color sequence (e.g., Green $\rightarrow$ Blue).
  - Verify matching chromatic illumination changes on the user's facial landmarks before authorizing entry.
- [ ] **Access Engine Integration**:
  - Add `liveness_score` to the evaluation engine; reject access with `LIVENESS_FAILED` if liveness confidence falls below configured threshold.

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
