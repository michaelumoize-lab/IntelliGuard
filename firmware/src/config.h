#pragma once

// ============================================================================
// IntelliGuard ESP32-S3 Firmware Configuration
// ============================================================================

// WiFi Configuration
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// Next.js Gateway Endpoint
// When testing against a local Next.js server, use your PC's LAN IP address (e.g. 192.168.1.100)
// On Wokwi (using Wokwi IoT Gateway), host.wokwi.internal maps to the host machine.
#define SERVER_HOST     "192.168.1.100"
#define SERVER_PORT     3000
#define ACCESS_ENDPOINT "/api/access"

// Device Authentication Credentials (Registered in IntelliGuard Admin)
#define DEVICE_ID       "1"
#define DEVICE_API_KEY  "ig_dev_sample_secret_key"

// Hardware Pinout Mappings (ESP32-S3 DevKitC-1)
#define PIN_PIR_MOTION  4      // HC-SR501 PIR Sensor (Digital Input)
#define PIN_RELAY_LOCK  5      // Relay Module (Active-LOW or Active-HIGH depending on RELAY_ACTIVE_LOW)
#define PIN_LED_GREEN   6      // Status LED Green (Granted)
#define PIN_LED_RED     7      // Status LED Red (Denied)
#define PIN_BUZZER      10     // Active Buzzer (Audible chime or alarm)

// I2C OLED Display (SSD1306 128x64)
#define PIN_I2C_SDA     8      // I2C SDA
#define PIN_I2C_SCL     9      // I2C SCL
#define OLED_SCREEN_WIDTH   128
#define OLED_SCREEN_HEIGHT  64
#define OLED_I2C_ADDRESS    0x3C

// Relay Actuation Properties
#define RELAY_ACTIVE_LOW    true   // Most relay breakout boards energize on LOW
#define UNLOCK_PULSE_MS     3500   // 3.5 seconds unlock pulse duration
#define SCAN_COOLDOWN_MS    2000   // Prevent repeated triggers

// Camera Pinout Configuration (ESP32-S3 Freenove / AI-Thinker S3 Pinout)
#define PWDN_GPIO_NUM       -1
#define RESET_GPIO_NUM      -1
#define XCLK_GPIO_NUM       40
#define SIOD_GPIO_NUM       17     // SCCB Data
#define SIOC_GPIO_NUM       18     // SCCB Clock
#define Y9_GPIO_NUM         39
#define Y8_GPIO_NUM         41
#define Y7_GPIO_NUM         42
#define Y6_GPIO_NUM         12
#define Y5_GPIO_NUM         3
#define Y4_GPIO_NUM         14
#define Y3_GPIO_NUM         38
#define Y2_GPIO_NUM         11
#define VSYNC_GPIO_NUM      6
#define HREF_GPIO_NUM       7
#define PCLK_GPIO_NUM       13
