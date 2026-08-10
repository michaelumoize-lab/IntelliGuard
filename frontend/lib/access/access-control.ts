import "dotenv/config";

export interface RecognitionInput {
  matchStatus: "matched" | "unknown" | "ambiguous";
  person?: {
    id: number;
    personCode: string;
    firstName: string;
    lastName: string;
    category: string;
    department: string | null;
    status?: string;
  } | null;
  similarity: number;
  distance: number;
  qualityScore?: number | null;
}

export interface AccessDecisionResult {
  accessStatus: "granted" | "denied";
  reason:
    | "face_match"
    | "face_no_match"
    | "insufficient_confidence"
    | "time_restriction"
    | "manual_override"
    | "system_error";
  doorAction: "unlock" | "lock" | "no_action";
}

/**
 * Evaluates recognition results and applies security rules to make final GRANTED / DENIED decision.
 * 
 * Rules:
 * - Rule 1: matched + active person + similarity >= FACE_MATCH_THRESHOLD -> GRANTED + face_match + unlock
 * - Rule 2: unknown face -> DENIED + face_no_match + lock
 * - Rule 3: ambiguous face -> DENIED + insufficient_confidence + lock
 * - Rule 4: inactive or suspended person -> DENIED + face_no_match + lock
 * - Rule 5: system error or invalid input -> DENIED + system_error + lock (Fail Closed)
 */
export function evaluateAccess(input: RecognitionInput): AccessDecisionResult {
  const matchThreshold = parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.50");

  try {
    if (!input || !input.matchStatus) {
      return {
        accessStatus: "denied",
        reason: "system_error",
        doorAction: "lock",
      };
    }

    // Rule 2: Unknown Face
    if (input.matchStatus === "unknown") {
      return {
        accessStatus: "denied",
        reason: "face_no_match",
        doorAction: "lock",
      };
    }

    // Rule 3: Ambiguous Recognition
    if (input.matchStatus === "ambiguous") {
      return {
        accessStatus: "denied",
        reason: "insufficient_confidence",
        doorAction: "lock",
      };
    }

    // Rule 4: Inactive or Suspended Person
    if (input.matchStatus === "matched" && input.person) {
      const personStatus = (input.person.status || "active").toLowerCase();
      if (personStatus !== "active") {
        return {
          accessStatus: "denied",
          reason: "face_no_match",
          doorAction: "lock",
        };
      }
    }

    // Rule 1: Valid Matched Active Person
    if (input.matchStatus === "matched" && input.person && input.similarity >= matchThreshold) {
      return {
        accessStatus: "granted",
        reason: "face_match",
        doorAction: "unlock",
      };
    }

    // Default Fail Closed Fallback
    return {
      accessStatus: "denied",
      reason: "face_no_match",
      doorAction: "lock",
    };
  } catch (error) {
    console.error("Error in access decision engine. Failing closed:", error);
    return {
      accessStatus: "denied",
      reason: "system_error",
      doorAction: "lock",
    };
  }
}
