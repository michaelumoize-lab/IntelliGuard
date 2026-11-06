import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface DeviceAuthOptions {
  timestamp?: string | number | null;
  nonce?: string | null;
  signature?: string | null;
  bodyHash?: string | null;
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
    | "replay_detected"
    | "invalid_signature";
  device?: {
    id: string;
    deviceCode: string;
    deviceName: string;
    serialNumber: string;
    status: string;
    location: string;
  } | null;
}

interface NonceEntry {
  deviceId: string;
  expiresAt: number;
}

// Shared sliding window cache of recent nonces across hot reloads and worker cycles: nonceKey -> NonceEntry
const globalForAuth = globalThis as unknown as {
  deviceRecentNonces?: Map<string, NonceEntry>;
  deviceNonceCleanupTimer?: NodeJS.Timeout;
};

const recentNonces = globalForAuth.deviceRecentNonces ?? new Map<string, NonceEntry>();
globalForAuth.deviceRecentNonces = recentNonces;

// Clean up expired nonces every 60 seconds
if (!globalForAuth.deviceNonceCleanupTimer && typeof setInterval !== "undefined") {
  globalForAuth.deviceNonceCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [nonceKey, entry] of recentNonces.entries()) {
      if (entry.expiresAt <= now) {
        recentNonces.delete(nonceKey);
      }
    }
  }, 60000);
  if (globalForAuth.deviceNonceCleanupTimer && typeof globalForAuth.deviceNonceCleanupTimer.unref === "function") {
    globalForAuth.deviceNonceCleanupTimer.unref();
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
  if (!deviceIdInput || !apiKeyInput) {
    return { isValid: false, reason: "invalid_credentials" };
  }

  const rawIdStr = String(deviceIdInput).trim();

  try {
    const device = await prisma.device.findFirst({
      where: {
        OR: [
          { deviceCode: rawIdStr },
          { serialNumber: rawIdStr },
        ],
      },
    });

    if (!device) {
      return { isValid: false, reason: "device_not_found" };
    }

    const safeDeviceObj = {
      ...device,
      id: device.deviceCode,
      deviceCode: device.deviceCode,
    };

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
      return { isValid: false, reason: "device_in_maintenance", device: safeDeviceObj };
    }

    if (device.status === "error") {
      return { isValid: false, reason: "device_error", device: safeDeviceObj };
    }

    // Require both timestamp and nonce in the authenticated device validation before replay-protection checks
    if (!options?.timestamp || !options?.nonce || !options.nonce.trim()) {
      return {
        isValid: false,
        reason: !options?.timestamp ? "invalid_timestamp" : "invalid_credentials",
        device: safeDeviceObj,
      };
    }

    // 1. Replay Protection: Timestamp freshness check (gated on authenticated device credentials)
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
      return { isValid: false, reason: "invalid_timestamp", device: safeDeviceObj };
    }

    const timeDiff = Math.abs(Date.now() - tsNumber);
    if (timeDiff > MAX_TIMESTAMP_SKEW_MS) {
      return { isValid: false, reason: "timestamp_expired", device: safeDeviceObj };
    }

    // 2. HMAC-SHA256 Signature Verification over deviceId, timestamp, nonce, and bodyHash
    // Performed BEFORE recording the nonce so unauthenticated or tampered requests cannot burn nonces.
    const isEnforceHmac = process.env.ENFORCE_DEVICE_HMAC === "true";
    if (options?.signature || isEnforceHmac) {
      if (!options?.signature) {
        return { isValid: false, reason: "invalid_signature", device: safeDeviceObj };
      }

      if (isEnforceHmac && (!options.bodyHash || !options.bodyHash.trim())) {
        return { isValid: false, reason: "invalid_signature", device: safeDeviceObj };
      }

      const trimmedNonce = options.nonce.trim();
      const candidateIdentifiers = Array.from(
        new Set([rawIdStr, device.deviceCode, device.serialNumber].filter(Boolean) as string[])
      );

      // Derive candidate signing keys:
      // 1. Server-side per-device HMAC secret (HMAC(DEVICE_HMAC_SECRET, device.apiKeyHash)) or stored apiKeyHash (never sent in plaintext headers)
      // 2. Plaintext apiKeyInput fallback when DEVICE_HMAC_SECRET is not configured for backward compatibility
      const candidateKeys: string[] = [device.apiKeyHash];
      if (process.env.DEVICE_HMAC_SECRET) {
        const derivedDeviceKey = crypto
          .createHmac("sha256", process.env.DEVICE_HMAC_SECRET)
          .update(device.apiKeyHash)
          .digest("hex");
        candidateKeys.unshift(derivedDeviceKey);
      } else {
        candidateKeys.push(apiKeyInput);
      }

      const sigClean = options.signature.trim().toLowerCase();
      const sigBuf = Buffer.from(sigClean, "utf8");

      let signatureMatched = false;
      for (const devIdent of candidateIdentifiers) {
        const canonicalPayloadWithHash = `${devIdent}:${options.timestamp}:${trimmedNonce}${
          options.bodyHash ? `:${options.bodyHash}` : ""
        }`;
        const canonicalPayloadWithoutHash = `${devIdent}:${options.timestamp}:${trimmedNonce}`;

        for (const signingKey of candidateKeys) {
          const expectedWithHash = crypto
            .createHmac("sha256", signingKey)
            .update(canonicalPayloadWithHash)
            .digest("hex")
            .toLowerCase();
          const expBufWith = Buffer.from(expectedWithHash, "utf8");
          const matchWith =
            sigBuf.length === expBufWith.length &&
            crypto.timingSafeEqual(sigBuf, expBufWith);

          let matchWithout = false;
          if (!isEnforceHmac) {
            const expectedWithoutHash = crypto
              .createHmac("sha256", signingKey)
              .update(canonicalPayloadWithoutHash)
              .digest("hex")
              .toLowerCase();
            const expBufWithout = Buffer.from(expectedWithoutHash, "utf8");
            matchWithout =
              sigBuf.length === expBufWithout.length &&
              crypto.timingSafeEqual(sigBuf, expBufWithout);
          }

          if (matchWith || matchWithout) {
            signatureMatched = true;
            break;
          }
        }
        if (signatureMatched) break;
      }

      if (!signatureMatched) {
        return { isValid: false, reason: "invalid_signature", device: safeDeviceObj };
      }
    }

    // 3. Replay Protection: Nonce uniqueness check (atomic check-and-set AFTER API key + HMAC verification)
    const nonceKey = `${safeDeviceObj.deviceCode}:${options.nonce.trim()}`;
    const now = Date.now();
    const existingNonce = recentNonces.get(nonceKey);
    if (existingNonce && existingNonce.expiresAt > now) {
      return { isValid: false, reason: "replay_detected", device: safeDeviceObj };
    }
    recentNonces.set(nonceKey, {
      deviceId: safeDeviceObj.deviceCode,
      expiresAt: now + MAX_TIMESTAMP_SKEW_MS,
    });

    // Update lastSeen timestamp and ensure status is online
    const updatedDevice = await prisma.device.update({
      where: { deviceCode: safeDeviceObj.deviceCode },
      data: {
        status: "online",
        lastSeen: new Date(),
      },
    });

    return {
      isValid: true,
      device: {
        ...updatedDevice,
        id: updatedDevice.deviceCode,
        deviceCode: updatedDevice.deviceCode,
      },
    };
  } catch (error) {
    console.error("Error authenticating device:", error);
    return { isValid: false, reason: "invalid_credentials" };
  }
}
