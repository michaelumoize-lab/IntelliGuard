import { prisma } from "@/lib/prisma";
import { AccessReason, AccessStatus, DoorAction, MatchStatus } from "@prisma/client";

export interface LogBiometricParams {
  deviceId: number | null;
  personId: number | null;
  embeddingId: number | null;
  matchStatus: MatchStatus;
  accessStatus: AccessStatus;
  reason: AccessReason;
  doorAction: DoorAction;
  confidenceScore: number | null;
  embeddingDistance: number | null;
  processingTimeMs: number;
}

export interface LogDeniedAlertParams {
  deviceId: number | null;
  person: {
    id: number;
    firstName: string;
    lastName: string;
    personCode: string;
    status?: string;
  } | null;
  matchStatus: string;
  isTailgating: boolean;
  trailingCount: number;
  isDeactivated: boolean;
  personStatus: string;
}

/**
 * Audit & Alert Persistence Module
 * Provides safe, isolated database logging for access events and security incidents.
 */
export class AuditLogger {
  /**
   * Log alert when a hardware device fails HMAC, nonce, or credential authentication.
   */
  static async logDeviceAuthAlert(
    device: { id: number; deviceName: string },
    reason: string | undefined,
    isReplayOrTamper: boolean
  ): Promise<void> {
    try {
      if (isReplayOrTamper) {
        await prisma.alert.create({
          data: {
            deviceId: device.id,
            alertType: "unauthorized_access",
            title: reason === "invalid_signature" ? "HMAC Tamper Attempt" : "Replay Attack Detected",
            message: `Device #${device.id} (${device.deviceName}) submitted an invalid access request (${reason}). Request blocked.`,
            severity: "critical",
          },
        });
      } else {
        await prisma.alert.create({
          data: {
            deviceId: device.id,
            alertType: "unauthorized_access",
            title: "Device Authentication Rejected",
            message: `Device #${device.id} (${device.deviceName}) failed authentication (${reason || "invalid_credentials"}). Request blocked.`,
            severity: "high",
          },
        });
      }
    } catch (err: unknown) {
      console.error("Failed to record device authentication alert:", err);
    }
  }

  /**
   * Log a system or external service failure (e.g. FastAPI down, vector search crash).
   */
  static async logSystemError(
    deviceId: number | null,
    processingTimeMs: number,
    alertTitle: string,
    alertMessage: string,
    severity: "low" | "medium" | "high" | "critical" = "high"
  ): Promise<void> {
    try {
      await prisma.accessLog.create({
        data: {
          deviceId,
          matchStatus: "rejected",
          accessStatus: "denied",
          reason: "system_error",
          doorAction: "lock",
          processingTimeMs,
        },
      });

      await prisma.alert.create({
        data: {
          deviceId,
          alertType: "system_error",
          title: alertTitle,
          message: alertMessage,
          severity,
        },
      });
    } catch (err: unknown) {
      console.error("Failed to persist system error log/alert:", err);
    }
  }

  /**
   * Log recognition error when biometric service fails to parse facial features.
   */
  static async logRecognitionError(
    deviceId: number | null,
    processingTimeMs: number
  ): Promise<void> {
    try {
      await prisma.accessLog.create({
        data: {
          deviceId,
          matchStatus: "rejected",
          accessStatus: "denied",
          reason: "system_error",
          doorAction: "lock",
          processingTimeMs,
        },
      });
    } catch (err: unknown) {
      console.error("Failed to record recognition_error AccessLog:", err);
    }
  }

  /**
   * Log presentation attack (spoof detected) access log and critical security alert.
   */
  static async logSpoofAttempt(
    deviceId: number | null,
    liveScore: number | null | undefined,
    modelName: string | undefined,
    processingTimeMs: number
  ): Promise<void> {
    try {
      await prisma.accessLog.create({
        data: {
          deviceId,
          matchStatus: "rejected",
          accessStatus: "denied",
          reason: "spoof_detected",
          doorAction: "lock",
          confidenceScore: liveScore ?? null,
          processingTimeMs,
        },
      });

      const liveScorePct = typeof liveScore === "number"
        ? (liveScore * 100).toFixed(1)
        : "0.0";

      await prisma.alert.create({
        data: {
          deviceId,
          alertType: "unauthorized_access",
          title: "Facial Presentation Attack (Spoof) Detected",
          message: `Anti-spoofing ensemble (${modelName || "MiniFASNet"}) detected a presentation attack (liveness score: ${liveScorePct}%). Access denied and door secured.`,
          severity: "critical",
        },
      });
    } catch (err: unknown) {
      console.error("Failed to record spoof_detected AccessLog/Alert:", err);
    }
  }

  /**
   * Log an inconclusive liveness result.
   */
  static async logLivenessInconclusive(
    deviceId: number | null,
    liveScore: number | null | undefined,
    processingTimeMs: number
  ): Promise<void> {
    try {
      await prisma.accessLog.create({
        data: {
          deviceId,
          matchStatus: "rejected",
          accessStatus: "denied",
          reason: "insufficient_confidence",
          doorAction: "no_action",
          confidenceScore: liveScore ?? null,
          processingTimeMs,
        },
      });
    } catch (err: unknown) {
      console.error("Failed to record liveness_inconclusive AccessLog:", err);
    }
  }

  /**
   * Persist successful or evaluated biometric verification AccessLog.
   */
  static async logBiometricDecision(params: LogBiometricParams): Promise<void> {
    try {
      await prisma.accessLog.create({
        data: {
          deviceId: params.deviceId,
          personId: params.personId,
          embeddingId: params.embeddingId,
          matchStatus: params.matchStatus,
          accessStatus: params.accessStatus,
          reason: params.reason,
          doorAction: params.doorAction,
          confidenceScore: params.confidenceScore,
          embeddingDistance: params.embeddingDistance,
          processingTimeMs: params.processingTimeMs,
        },
      });
    } catch (err: unknown) {
      console.error("Failed to record biometric AccessLog:", err);
    }
  }

  /**
   * Persist security alerts for denied biometric access (tailgating, unknown face, ambiguous match, deactivated/suspended account).
   */
  static async logBiometricDeniedAlert(params: LogDeniedAlertParams): Promise<void> {
    const { deviceId, person, matchStatus, isTailgating, trailingCount, isDeactivated, personStatus } = params;

    try {
      if (isTailgating) {
        await prisma.alert.create({
          data: {
            deviceId,
            personId: person?.id || null,
            alertType: "unauthorized_access",
            title: "Tailgating / Piggybacking Security Violation",
            message: `Tailgating violation: ${trailingCount || 1} trailing individual(s) detected in access threshold while ${
              person ? `${person.firstName} ${person.lastName}` : "a user"
            } presented biometrics. Access denied and door secured.`,
            severity: "high",
          },
        });
      } else if (matchStatus === "unknown") {
        await prisma.alert.create({
          data: {
            deviceId,
            personId: null,
            alertType: "unknown_face",
            title: "Unknown Face Detected",
            message: "An unrecognized face attempted access.",
            severity: "medium",
          },
        });
      } else if (matchStatus === "ambiguous") {
        await prisma.alert.create({
          data: {
            deviceId,
            personId: null,
            alertType: "unauthorized_access",
            title: "Ambiguous Face Recognition",
            message: "Face recognition produced competing candidates with insufficient confidence margin.",
            severity: "medium",
          },
        });
      } else if (isDeactivated && person) {
        const isSuspended = personStatus === "suspended";
        await prisma.alert.create({
          data: {
            deviceId,
            personId: person.id,
            alertType: "unauthorized_access",
            title: isSuspended
              ? "Access Denied - Suspended User"
              : "Access Denied - Deactivated User",
            message: `${person.firstName} ${person.lastName} (${person.personCode}) attempted access while ${
              isSuspended ? "suspended" : "deactivated"
            } (${personStatus}). User is not allowed to access the system.`,
            severity: "high",
          },
        });
      }
    } catch (err: unknown) {
      console.error("Failed to create security alert for denied access:", err);
    }
  }
}
