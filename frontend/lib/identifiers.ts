import crypto from "crypto";
import { uuidv7 } from "uuidv7";

/**
 * IntelliGuard Business Identifier & UUIDv7 System
 * 
 * Centralized generation and validation of:
 * 1. Human-readable public business identifiers (PER-, DEV-, EMB-, REC-, ALT-, ACL-).
 * 2. RFC 9562-compliant UUIDv7 identifiers for internal database keys and relationships.
 */

// ---------------------------------------------------------------------------
// UUIDv7 Generation & Validation (RFC 9562)
// ---------------------------------------------------------------------------

/**
 * Regex pattern for strictly validating an RFC 9562 UUID version 7.
 * Format: 8-4-4-4-12 hex chars.
 * 13th char MUST be '7' (version).
 * 17th char MUST be '8', '9', 'a', or 'b' (variant 1).
 */
export const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generate a standards-compliant, time-ordered UUIDv7.
 * Uses cryptographically secure random entropy and millisecond timestamp.
 */
export function generateUuidV7(): string {
  return uuidv7();
}

/**
 * Validate whether a given value is a valid RFC 9562 UUIDv7 string.
 */
export function isValidUuidV7(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return UUID_V7_PATTERN.test(value);
}

/**
 * Extract the embedded Unix timestamp from a UUIDv7.
 * The first 48 bits represent Unix epoch timestamp in milliseconds.
 */
export function extractTimestampFromUuidV7(uuid: string): Date | null {
  if (!isValidUuidV7(uuid)) return null;
  const hexTime = uuid.replace(/-/g, "").slice(0, 12);
  const ms = parseInt(hexTime, 16);
  return new Date(ms);
}


export const IDENTIFIER_PREFIXES = {
  PERSON: "PER-",
  DEVICE: "DEV-",
  FACE_EMBEDDING: "EMB-",
  RECOGNITION_EVENT: "REC-",
  ALERT: "ALT-",
  ACCESS_LOG: "ACL-",
} as const;

export type EntityType = keyof typeof IDENTIFIER_PREFIXES;
export type IdentifierPrefix = (typeof IDENTIFIER_PREFIXES)[EntityType];

/** Standard random suffix length: 12 hexadecimal characters (48 bits of entropy) */
export const SUFFIX_HEX_LENGTH = 12;

/**
 * Generate a cryptographically secure random hexadecimal suffix.
 * Uses 6 bytes = 12 uppercase hexadecimal characters.
 */
function generateRandomHexSuffix(length: number = SUFFIX_HEX_LENGTH): string {
  const byteCount = Math.ceil(length / 2);
  const buffer = crypto.randomBytes(byteCount);
  return buffer.toString("hex").slice(0, length).toUpperCase();
}

/**
 * Generate a business identifier with the specified entity prefix.
 * Example output: 'PER-17BF059C1234', 'DEV-7A2D19F4B620'
 */
export function generateBusinessIdentifier(prefix: IdentifierPrefix): string {
  return `${prefix}${generateRandomHexSuffix(SUFFIX_HEX_LENGTH)}`;
}

// ---------------------------------------------------------------------------
// Entity-specific Generator Functions
// ---------------------------------------------------------------------------

/** Generate a unique Person code (e.g. 'PER-17BF059C1234') */
export function generatePersonCode(): string {
  return generateBusinessIdentifier(IDENTIFIER_PREFIXES.PERSON);
}

/** Generate a unique Device code (e.g. 'DEV-7A2D19F4B620') */
export function generateDeviceCode(): string {
  return generateBusinessIdentifier(IDENTIFIER_PREFIXES.DEVICE);
}

/** Generate a unique FaceEmbedding code (e.g. 'EMB-9C31E8A2F741') */
export function generateEmbeddingCode(): string {
  return generateBusinessIdentifier(IDENTIFIER_PREFIXES.FACE_EMBEDDING);
}
export const generateFaceEmbeddingCode = generateEmbeddingCode;

/** Generate a unique RecognitionEvent code (e.g. 'REC-5B8F20D1A963') */
export function generateRecognitionEventCode(): string {
  return generateBusinessIdentifier(IDENTIFIER_PREFIXES.RECOGNITION_EVENT);
}

/** Generate a unique Alert code (e.g. 'ALT-4D7A91C3B825') */
export function generateAlertCode(): string {
  return generateBusinessIdentifier(IDENTIFIER_PREFIXES.ALERT);
}

/** Generate a unique AccessLog / access decision code (e.g. 'ACL-8E2B61F4C930') */
export function generateAccessCode(): string {
  return generateBusinessIdentifier(IDENTIFIER_PREFIXES.ACCESS_LOG);
}
export const generateAccessLogCode = generateAccessCode;

// ---------------------------------------------------------------------------
// Validation & Parsing Helpers
// ---------------------------------------------------------------------------

/**
 * Standard business identifier regex pattern:
 * Allows standard 12-hex suffixes, while maintaining backward compatibility
 * with legacy 8-hex suffixes (e.g. earlier person codes like 'PER-17BF059C').
 */
export const BUSINESS_ID_PATTERN = /^(PER|DEV|EMB|REC|ALT|ACL)-[0-9A-F]{8,16}$/;

/**
 * Validate whether a string is a valid business identifier.
 * Optionally verifies matching a specific prefix.
 */
export function isValidBusinessIdentifier(
  identifier: unknown,
  expectedPrefix?: IdentifierPrefix
): boolean {
  if (typeof identifier !== "string") return false;
  if (!BUSINESS_ID_PATTERN.test(identifier)) return false;
  if (expectedPrefix && !identifier.startsWith(expectedPrefix)) return false;
  return true;
}

/**
 * Extract the prefix from a business identifier if valid.
 */
export function getIdentifierPrefix(identifier: string): IdentifierPrefix | null {
  for (const prefix of Object.values(IDENTIFIER_PREFIXES)) {
    if (identifier.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Collision Retry Mechanism
// ---------------------------------------------------------------------------

export interface CollisionRetryOptions {
  maxRetries?: number;
  entityName?: string;
}

/**
 * Generate a business identifier with collision avoidance retry logic.
 * 
 * @param generatorFn Function returning a newly generated identifier
 * @param existsFn Async check that returns true if the identifier already exists in DB
 * @param options Configuration for retry limit and entity name for errors
 */
export async function generateUniqueBusinessIdentifier(
  generatorFn: () => string,
  existsFn: (code: string) => Promise<boolean>,
  options: CollisionRetryOptions = {}
): Promise<string> {
  const { maxRetries = 5, entityName = "record" } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const candidate = generatorFn();
    const exists = await existsFn(candidate);
    if (!exists) {
      return candidate;
    }
    console.warn(
      `[Identifier Collision] Candidate '${candidate}' already exists for ${entityName}. Retry attempt ${attempt}/${maxRetries}.`
    );
  }

  throw new Error(
    `Failed to generate unique business identifier for ${entityName} after ${maxRetries} attempts.`
  );
}
