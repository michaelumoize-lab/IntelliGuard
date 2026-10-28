# IntelliGuard Firmware & Hardware Simulation Guide

This directory contains the edge firmware for the **ESP32-S3-CAM** access control unit and simulation tools to test hardware behavior without physical devices.

---

## 1. Directory Structure

```text
firmware/
├── platformio.ini         # PlatformIO project configuration (ESP32-S3 DevKitC-1)
├── diagram.json           # Wokwi circuit simulation diagram
├── libraries.txt          # Library dependencies for Wokwi web simulator
├── mock_esp32_client.py   # Python virtual edge hardware client
├── src/
│   ├── config.h           # WiFi, Pinout, Server endpoint, and Credential definitions
│   └── main.cpp           # Main firmware logic (Camera, PIR, Relay, OLED, HTTP)
└── README.md
```

---

## 2. Testing Method A: Virtual Edge Client (Immediate Test)

You can test the entire backend pipeline (`Next.js <-> FastAPI <-> PostgreSQL/pgvector`) right from your terminal without any microcontroller:

1. Ensure the Next.js server is running (`npm run dev` in `frontend/`).
2. Run the mock client with any facial photo:
   ```bash
   python firmware/mock_esp32_client.py path/to/your_photo.jpg
   ```
3. The script sends the exact HTTP headers (`X-Device-Id`, `X-Api-Key`, `X-Timestamp`, `X-Nonce`) and JPEG multipart payload to `POST /api/access`.
4. Inspect the returned JSON (`door_action`, `access_status`, `person`, `similarity`).

---

## 3. Testing Method B: Wokwi Online Simulator

1. Go to [Wokwi ESP32-S3 Simulator](https://wokwi.com/).
2. Create a new **ESP32-S3** project.
3. Switch to the `diagram.json` tab and paste the contents of `firmware/diagram.json`.
4. Add the libraries in `libraries.txt` (`Adafruit SSD1306`, `Adafruit GFX Library`, `ArduinoJson`).
5. Copy `src/main.cpp` and `src/config.h` into the sketch tab. Set `#define WOKWI_SIMULATION 1` at the top of `main.cpp`.
6. Click **Start Simulation**:
   * Click on the **PIR sensor** to simulate motion.
   * Watch the **OLED display** change from "READY" to "PROCESSING" -> "ACCESS GRANTED" / "ACCESS DENIED".
   * Observe the **Relay** energize and de-energize (LED indicator).

---

## 4. Flashing to Physical Hardware (When Hardware Arrives)

When your physical **ESP32-S3-CAM** board arrives:
1. Open the `firmware/` folder in VS Code with the **PlatformIO IDE** extension installed.
2. In `src/config.h`:
   * Set your real `WIFI_SSID` and `WIFI_PASSWORD`.
   * Set `SERVER_HOST` to your production server IP/domain or local PC IP.
   * Set `DEVICE_ID` and `DEVICE_API_KEY` to the device registered in your admin dashboard.
3. Connect your board via USB-C.
4. Click **PlatformIO: Upload** and **PlatformIO: Serial Monitor** (115200 baud).
