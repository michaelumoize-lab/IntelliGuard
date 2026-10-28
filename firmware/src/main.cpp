#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

#include "config.h"

// Set to true if compiling for Wokwi without a physical camera sensor
#ifndef WOKWI_SIMULATION
#define WOKWI_SIMULATION 0
#endif

#if !WOKWI_SIMULATION
#include "esp_camera.h"
#endif

// Global Peripherals
Adafruit_SSD1306 display(OLED_SCREEN_WIDTH, OLED_SCREEN_HEIGHT, &Wire, -1);
WiFiClient client;

// State management
unsigned long lastScanTime = 0;
bool isLocked = true;

// 1x1 107-byte valid JPEG for simulation test in Wokwi
static const uint8_t MOCK_JPEG[] = {
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
  0x00, 0x60, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
  0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
  0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
  0x00, 0xBF, 0x80, 0xFF, 0xD9
};

// ============================================================================
// UI & OLED Helper Functions
// ============================================================================
void showOledMessage(const char* title, const char* line1, const char* line2 = "") {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.print(F("=== INTELLIGUARD ==="));
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setCursor(0, 18);
  display.setTextSize(1);
  display.println(title);

  display.setCursor(0, 34);
  display.setTextSize(1);
  display.println(line1);

  if (strlen(line2) > 0) {
    display.setCursor(0, 48);
    display.println(line2);
  }
  display.display();
}

void setRelayState(bool lock) {
  isLocked = lock;
  if (RELAY_ACTIVE_LOW) {
    // LOW = Energized (Unlocked), HIGH = De-energized (Locked)
    digitalWrite(PIN_RELAY_LOCK, lock ? HIGH : LOW);
  } else {
    digitalWrite(PIN_RELAY_LOCK, lock ? LOW : HIGH);
  }
}

void triggerDeniedFeedback(const char* reasonMsg) {
  setRelayState(true); // Fail-closed: ensure relay locked
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
  
  // Quick double chirp on buzzer
  digitalWrite(PIN_BUZZER, HIGH);
  delay(120);
  digitalWrite(PIN_BUZZER, LOW);
  delay(80);
  digitalWrite(PIN_BUZZER, HIGH);
  delay(120);
  digitalWrite(PIN_BUZZER, LOW);

  showOledMessage("ACCESS DENIED", reasonMsg, "Door Locked");
  delay(2000);
  digitalWrite(PIN_LED_RED, LOW);
  showOledMessage("READY", "Approach Camera", "PIR Active");
}

void triggerGrantedFeedback(const char* personName) {
  Serial.printf("[ACCESS] Access Granted for: %s. Unlocking door.\n", personName);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);
  
  // Pleasant confirmation chime
  digitalWrite(PIN_BUZZER, HIGH);
  delay(200);
  digitalWrite(PIN_BUZZER, LOW);

  // Energize Relay
  setRelayState(false);
  showOledMessage("ACCESS GRANTED", "Welcome,", personName);

  // Keep door unlocked for configured pulse duration
  delay(UNLOCK_PULSE_MS);

  // Relock door
  setRelayState(true);
  digitalWrite(PIN_LED_GREEN, LOW);
  Serial.println("[ACCESS] Door relocked.");
  showOledMessage("READY", "Approach Camera", "PIR Active");
}

// ============================================================================
// Camera Setup
// ============================================================================
bool setupCamera() {
#if WOKWI_SIMULATION
  Serial.println("[CAM] Wokwi Simulation mode active (Camera hardware bypassed).");
  return true;
#else
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;   // 640x480
    config.jpeg_quality = 12;            // High quality (lower is better, 0-63)
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_QVGA;  // 320x240 fallback
    config.jpeg_quality = 14;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Camera init failed with error 0x%x\n", err);
    return false;
  }
  Serial.println("[CAM] Camera initialized successfully.");
  return true;
#endif
}

// ============================================================================
// Network & HTTP Upload with Nonce and Timestamp
// ============================================================================
void processAccessRequest() {
  showOledMessage("PROCESSING", "Verifying Face...", "Please wait");

  const uint8_t* imageBuffer = nullptr;
  size_t imageLen = 0;

#if WOKWI_SIMULATION
  imageBuffer = MOCK_JPEG;
  imageLen = sizeof(MOCK_JPEG);
#else
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[CAM] Error capturing image from sensor.");
    triggerDeniedFeedback("Sensor Capture Err");
    return;
  }
  imageBuffer = fb->buf;
  imageLen = fb->len;
#endif

  Serial.printf("[HTTP] Connecting to gateway %s:%d...\n", SERVER_HOST, SERVER_PORT);
  if (!client.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("[HTTP] Gateway connection failed!");
#if !WOKWI_SIMULATION
    esp_camera_fb_return(fb);
#endif
    triggerDeniedFeedback("Gateway Offline");
    return;
  }

  // Generate unique nonce and timestamp for replay protection
  unsigned long timestamp = millis() / 1000 + 1729000000; // Epoch timestamp approximation
  String nonce = "esp_" + String(millis()) + "_" + String(random(1000, 9999));
  String boundary = "----IntelliGuardBoundary" + String(millis());

  // Construct Multipart Head & Tail
  String head = "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";

  String tail = "\r\n--" + boundary + "--\r\n";

  size_t totalPayloadLength = head.length() + imageLen + tail.length();

  // Send HTTP POST Headers
  client.printf("POST %s HTTP/1.1\r\n", ACCESS_ENDPOINT);
  client.printf("Host: %s:%d\r\n", SERVER_HOST, SERVER_PORT);
  client.printf("X-Device-Id: %s\r\n", DEVICE_ID);
  client.printf("X-Api-Key: %s\r\n", DEVICE_API_KEY);
  client.printf("X-Timestamp: %lu\r\n", timestamp);
  client.printf("X-Nonce: %s\r\n", nonce.c_str());
  client.println("Connection: close");
  client.printf("Content-Type: multipart/form-data; boundary=%s\r\n", boundary.c_str());
  client.printf("Content-Length: %u\r\n\r\n", totalPayloadLength);

  // Send Multipart Head
  client.print(head);

  // Stream Image in 1024-byte chunks to protect heap
  const size_t CHUNK_SIZE = 1024;
  for (size_t offset = 0; offset < imageLen; offset += CHUNK_SIZE) {
    size_t chunk = (imageLen - offset < CHUNK_SIZE) ? (imageLen - offset) : CHUNK_SIZE;
    client.write(&imageBuffer[offset], chunk);
  }

  // Send Multipart Tail
  client.print(tail);

#if !WOKWI_SIMULATION
  esp_camera_fb_return(fb);
#endif

  // Read Response
  unsigned long timeout = millis();
  while (client.connected() && millis() - timeout < 5000) {
    if (client.available()) break;
    delay(10);
  }

  if (!client.available()) {
    Serial.println("[HTTP] Gateway response timeout (5000ms reached). Failing closed.");
    client.stop();
    triggerDeniedFeedback("Timeout / Fail");
    return;
  }

  // Skip HTTP headers and read JSON payload
  bool isBody = false;
  String jsonBody = "";
  while (client.available()) {
    String line = client.readStringUntil('\n');
    if (line == "\r" || line.length() == 0) {
      isBody = true;
      break;
    }
  }

  if (isBody) {
    while (client.available()) {
      jsonBody += client.readString();
    }
  }
  client.stop();

  Serial.println("[HTTP] Response Received:");
  Serial.println(jsonBody);

  // Parse JSON response using ArduinoJson v7
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, jsonBody);

  if (error) {
    Serial.printf("[JSON] Deserialization error: %s\n", error.c_str());
    triggerDeniedFeedback("Malformed Response");
    return;
  }

  const char* doorAction = doc["door_action"] | "lock";
  const char* accessStatus = doc["access_status"] | "denied";
  const char* reason = doc["reason"] | "unknown";
  const char* personName = doc["person"]["name"] | "Authorized User";

  if (strcmp(doorAction, "unlock") == 0 && strcmp(accessStatus, "granted") == 0) {
    triggerGrantedFeedback(personName);
  } else {
    triggerDeniedFeedback(reason);
  }
}

// ============================================================================
// Setup & Main Loop
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- INTELLIGUARD ESP32-S3 BOOT ---");

  // Ensure relay is securely locked before changing pin mode
  setRelayState(true);
  pinMode(PIN_RELAY_LOCK, OUTPUT);
  setRelayState(true);

  pinMode(PIN_PIR_MOTION, INPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Initialize I2C and OLED
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS)) {
    Serial.println("[OLED] SSD1306 allocation failed!");
  } else {
    display.clearDisplay();
    showOledMessage("BOOTING...", "Connecting WiFi");
  }

  // Connect to WiFi
  Serial.printf("[WIFI] Connecting to %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected! IP Address: ");
    Serial.println(WiFi.localIP());
    showOledMessage("WIFI READY", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Failed to connect! Working in offline lock state.");
    showOledMessage("WIFI FAILED", "Offline Mode");
  }

  // Camera Setup
  setupCamera();

  delay(1500);
  showOledMessage("READY", "Approach Camera", "PIR Active");
}

void loop() {
  // Check PIR motion sensor
  int pirVal = digitalRead(PIN_PIR_MOTION);

  if (pirVal == HIGH) {
    unsigned long now = millis();
    if (now - lastScanTime > SCAN_COOLDOWN_MS) {
      Serial.println("[PIR] Motion detected! Triggering face recognition...");
      lastScanTime = now;
      processAccessRequest();
    }
  }

  delay(50);
}
