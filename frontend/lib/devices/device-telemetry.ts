export interface DeviceTelemetryData {
  deviceId: number;
  ipAddress?: string;
  firmwareVersion?: string;
  wifiRssi?: number; // Wi-Fi Signal Strength in dBm (e.g., -55 dBm)
  freeHeapBytes?: number; // Available RAM on microcontroller (e.g., 184320 bytes)
  uptimeSeconds?: number;
  doorState?: "locked" | "unlocked";
  lastPing: number; // Unix timestamp ms
}

// In-memory telemetry cache for active IoT edge nodes
const telemetryMap = new Map<number, DeviceTelemetryData>();

export const HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes threshold before flagging offline

export function recordDeviceHeartbeat(data: DeviceTelemetryData): void {
  telemetryMap.set(data.deviceId, {
    ...data,
    lastPing: Date.now(),
  });
}

export function getDeviceTelemetry(deviceId: number): DeviceTelemetryData | null {
  const telemetry = telemetryMap.get(deviceId);
  if (!telemetry) return null;
  return telemetry;
}

export function isDeviceOnline(lastSeen: Date | string | null | undefined): boolean {
  if (!lastSeen) return false;
  const lastSeenMs = typeof lastSeen === "string" ? new Date(lastSeen).getTime() : lastSeen.getTime();
  return Date.now() - lastSeenMs <= HEARTBEAT_TIMEOUT_MS;
}
