import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface DeviceAuthResult {
  isValid: boolean;
  reason?: "device_not_found" | "invalid_credentials" | "device_in_maintenance" | "device_error";
  device?: {
    id: number;
    deviceName: string;
    serialNumber: string;
    status: string;
    location: string;
  } | null;
}

/**
 * Authenticates hardware devices using SHA-256 hashed API key verification.
 * Also handles admin/browser simulation calls when device credentials are omitted.
 */
export async function authenticateDevice(
  deviceIdInput?: number | string | null,
  apiKeyInput?: string | null
): Promise<DeviceAuthResult> {
  const deviceId = typeof deviceIdInput === "string" ? parseInt(deviceIdInput, 10) : deviceIdInput;
  if (!deviceId || isNaN(deviceId) || !apiKeyInput) {
    return { isValid: false, reason: "invalid_credentials" };
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
