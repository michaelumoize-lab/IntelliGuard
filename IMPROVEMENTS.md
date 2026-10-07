# IntelliGuard System Improvements & Computer Engineering Capstone Roadmap

This document outlines architectural enhancements, engineering recommendations, and future improvements for **IntelliGuard**, specifically focused on elevating the system for production deployment, academic thesis presentation, and hardware-software integration.

---

## 1. Embedded Hardware & IoT Protocol Enhancements

### 1.1 MQTT / WebSocket Communication
* **Current State:** HTTP REST requests sent per frame capture.
* **Proposed Enhancement:** Implement **MQTT with TLS** (via Mosquitto / AWS IoT Core) or persistent **WebSockets**.
* **Impact:** 
  * Reduces HTTP packet header overhead.
  * Enables sub-100ms bi-directional communication between the Next.js gateway and ESP32-S3 devices.
  * Allows real-time remote commands (e.g., immediate door unlock, firmware reboot, configuration updates).

### 1.2 PIR Motion-Triggered Deep Sleep Modes
* **Current State:** Continuous streaming or manual capture trigger.
* **Proposed Enhancement:** Configure the ESP32-S3 to operate in **Deep Sleep Mode** ($\sim \mu\text{A}$ current draw) until an external GPIO interrupt is triggered by the PIR motion sensor.
* **Impact:**
  * Dramatically reduces power consumption for battery/solar-powered edge deployments.
  * Enables real-world battery life calculations and power profiling for capstone hardware documentation.

### 1.3 Offline Fail-Safe & Hardware Resilience
* **Current State:** Relies on continuous network connectivity to the FastAPI/Next.js backend.
* **Proposed Enhancement:** Add an offline emergency backup mechanism (e.g., local matrix keypad PIN fallback or local RFID module attached to ESP32 SPI bus).
* **Impact:** Ensures physical access remains functional during Wi-Fi or server outages.

---

## 2. Artificial Intelligence & Edge Vision Optimizations

### 2.1 Anti-Spoofing & Liveness Detection
* **Current State:** 2D facial embedding recognition via InsightFace (`buffalo_l` / `buffalo_s`).
* **Proposed Enhancement:** Add active/passive liveness verification before granting entry:
  * **Passive Liveness:** Blinking detection, head pose variation tracking, or texture/specular reflection analysis in FastAPI.
  * **Hardware-Assisted Liveness:** Flash the ESP32 RGB LED in a randomized color sequence during frame capture and verify facial illumination response in the AI pipeline.
* **Impact:** Prevents unauthorized entry using printed photos or smartphone screens.

### 2.2 On-Device Edge Pre-Filtering (ESP-WHO / TFLite Micro)
* **Current State:** Raw camera frames transmitted directly over Wi-Fi for backend inference.
* **Proposed Enhancement:** Execute a ultra-lightweight face detector (e.g., ESP-WHO / MobileNet TFLite Micro) directly on the ESP32-S3 PSRAM.
* **Impact:**
  * Only sends frames over Wi-Fi when a valid human face is detected locally.
  * Saves server CPU/GPU resources and minimizes unnecessary network traffic.

---

## 3. System Benchmarking & Engineering Evaluation Framework

For academic and engineering presentation, document the following quantitative metrics:

| Metric Category | Target Evaluation Parameter | Measurement Method / Tool |
| :--- | :--- | :--- |
| **End-to-End Latency** | Capture $\rightarrow$ Transmission $\rightarrow$ Inference $\rightarrow$ Vector Search $\rightarrow$ Relaying | `execution_time_ms`, Server logs, Oscilloscope/Logic Analyzer |
| **Recognition Accuracy** | False Acceptance Rate (FAR) vs. False Rejection Rate (FRR) | Evaluate threshold range (0.40 – 0.70) against test datasets |
| **Model Performance** | `buffalo_s` vs. `buffalo_l` inference time & RAM usage | Pytest / ONNX Runtime benchmarks |
| **Power Consumption** | ESP32-S3 Active Streaming vs. PIR Deep Sleep | Multimeter / Power Profiler |

---

## 4. Security & Enterprise Infrastructure

* **Device Authentication:** Implement mutual TLS (mTLS) or HMAC token signatures for all ESP32-to-Backend HTTP/MQTT requests to prevent rogue device spoofing.
* **Audit Logging:** Maintain encrypted PostgreSQL audit logs for every access attempt, including captured snapshot metadata and vector distance scores.
