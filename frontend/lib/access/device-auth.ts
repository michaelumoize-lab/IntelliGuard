import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface DeviceAuthOptions {
  timestamp?: string | number | null;
  nonce?: string | null;
  signature?: string | null;
}

export interface DeviceAuthResult {
  isValid: boolean;
  reason?:
    | "device_not_found"
    | "invalid_credentials"
    | "device_in_maintenance"
    | "device_error"
    | "timestamp_expired"
    | "invalid_timestamp"
    | "replay_detected";
  device?: {
    id: number;
    deviceName: string;
    serialNumber: string;
    status: string;
    location: string;
  } | null;
}

interface NonceEntry {
  deviceId: number;
  expiresAt: number;
}

// In-memory sliding window cache of recent nonces: nonceKey -> NonceEntry
const recentNonces = new Map<string, NonceEntry>();

// Clean up expired nonces every 60 seconds
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [nonceKey, entry] of recentNonces.entries()) {
      if (entry.expiresAt <= now) {
        recentNonces.delete(nonceKey);
      }
    }
  }, 60000);
  if (cleanupTimer && typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }
}

// Allowed clock skew / timestamp freshness window: 5 minutes (300,000 ms)
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

/**
 * Authenticates hardware devices using SHA-256 hashed API key verification,
 * with cryptographic replay attack mitigation (timestamp freshness window + unique nonce tracking).
 */
export async function authenticateDevice(
  deviceIdInput?: number | string | null,
  apiKeyInput?: string | null,
  options?: DeviceAuthOptions
): Promise<DeviceAuthResult> {
  const deviceId = typeof deviceIdInput === "string" ? parseInt(deviceIdInput, 10) : deviceIdInput;
  if (!deviceId || isNaN(deviceId) || !apiKeyInput) {
    return { isValid: false, reason: "invalid_credentials" };
  }

  // 1. Replay Protection: Timestamp freshness check
  if (options?.timestamp) {
    let tsNumber: number;
    if (typeof options.timestamp === "number") {
      tsNumber = options.timestamp < 10000000000 ? options.timestamp * 1000 : options.timestamp;
    } else {
      const parsedNum = Number(options.timestamp);
      if (!isNaN(parsedNum)) {
        tsNumber = options.timestamp.length <= 10 ? parsedNum * 1000 : parsedNum;
      } else {
        tsNumber = Date.parse(options.timestamp);
      }
    }

    if (isNaN(tsNumber)) {
      return { isValid: false, reason: "invalid_timestamp" };
    }

    const timeDiff = Math.abs(Date.now() - tsNumber);
    if (timeDiff > MAX_TIMESTAMP_SKEW_MS) {
      return { isValid: false, reason: "timestamp_expired" };
    }
  }

  // 2. Replay Protection: Nonce uniqueness check
  if (options?.nonce) {
    const nonceKey = `${deviceId}:${options.nonce.trim()}`;
    if (recentNonces.has(nonceKey)) {
      return { isValid: false, reason: "replay_detected" };
    }
    recentNonces.set(nonceKey, {
      deviceId,
      expiresAt: Date.now() + MAX_TIMESTAMP_SKEW_MS,
    });
  }

  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return { isValid: false, reason: "device_not_found" };
    }

    // Securely compare SHA-256 hashed API key using constant-time comparison
    const hashedApiKey = crypto.createHash("sha256").update(apiKeyInput).digest("hex");
    const hashedBuffer = Buffer.from(hashedApiKey);
    const expectedBuffer = Buffer.from(device.apiKeyHash);
    const isHashMatch =
      hashedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(hashedBuffer, expectedBuffer);

    if (!isHashMatch) {
      return { isValid: false, reason: "invalid_credentials" };
    }

    // Device status rules: maintenance or error devices cannot unlock doors
    if (device.status === "maintenance") {
      return { isValid: false, reason: "device_in_maintenance", device };
    }

    if (device.status === "error") {
      return { isValid: false, reason: "device_error", device };
    }

    // Update lastSeen timestamp and ensure status is online
    const updatedDevice = await prisma.device.update({
      where: { id: device.id },
      data: {
        status: "online",
        lastSeen: new Date(),
      },
    });

    return {
      isValid: true,
      device: {
        id: updatedDevice.id,
        deviceName: updatedDevice.deviceName,
        serialNumber: updatedDevice.serialNumber,
        status: updatedDevice.status,
        location: updatedDevice.location,
      },
    };
  } catch (error) {
    console.error("Error authenticating device:", error);
    return { isValid: false, reason: "invalid_credentials" };
  }
}
