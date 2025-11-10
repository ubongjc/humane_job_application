/**
 * CRYPTOGRAPHIC HASH UTILITIES
 *
 * Stable, deterministic hashing for:
 * - Decision receipts (audit trail)
 * - Data integrity verification
 * - Idempotency keys
 * - Cache keys
 */

import crypto from "crypto";

/**
 * Create stable SHA-256 hash of decision data
 *
 * The hash is deterministic and includes:
 * - Generated letter content
 * - Rejection reasons
 * - Template version
 * - Rubric deltas
 * - Timestamp
 */
export function hashDecision(params: {
  letter: string;
  reasons: string[];
  templateVersion?: string;
  rubricDeltas?: any;
  timestamp?: string;
}): string {
  const canonical = JSON.stringify({
    letter: params.letter.trim(),
    reasons: params.reasons.sort(), // Stable order
    templateVersion: params.templateVersion || "unknown",
    rubricDeltas: params.rubricDeltas || null,
    timestamp: params.timestamp || new Date().toISOString(),
  });

  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Create HMAC signature for tamper detection
 */
export function signHash(
  hash: string,
  secret: string = process.env.HASH_SECRET || "change-me-in-production"
): string {
  return crypto.createHmac("sha256", secret).update(hash).digest("hex");
}

/**
 * Verify HMAC signature
 */
export function verifySignature(
  hash: string,
  signature: string,
  secret: string = process.env.HASH_SECRET || "change-me-in-production"
): boolean {
  const expected = signHash(hash, secret);

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

/**
 * Generate stable hash of any data (for cache keys, idempotency, etc.)
 */
export function hashData(data: any): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Generate short hash (first 16 chars) for readable identifiers
 */
export function shortHash(data: any): string {
  return hashData(data).substring(0, 16);
}

/**
 * Create deterministic UUID v5 from namespace + name
 */
export function uuidv5(name: string, namespace: string = "humane-job"): string {
  const hash = crypto
    .createHash("sha1")
    .update(namespace + name)
    .digest("hex");

  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "5" + hash.substring(13, 16), // Version 5
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) +
      hash.substring(18, 20),
    hash.substring(20, 32),
  ].join("-");
}

/**
 * Hash personally identifiable information (PII) for anonymization
 */
export function hashPII(
  pii: string,
  salt: string = process.env.PII_SALT || "change-me"
): string {
  return crypto
    .createHash("sha256")
    .update(salt + pii)
    .digest("hex");
}

/**
 * Create bcrypt-style hash for sensitive data (slow, suitable for passwords)
 */
export async function hashSensitive(data: string, rounds: number = 10): Promise<string> {
  // Using pbkdf2 as bcrypt alternative (built-in to Node.js)
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      data,
      crypto.randomBytes(16),
      10 ** rounds,
      64,
      "sha512",
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString("hex"));
      }
    );
  });
}

/**
 * Verify sensitive hash
 */
export async function verifySensitive(
  data: string,
  hash: string
): Promise<boolean> {
  const newHash = await hashSensitive(data);
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(newHash)
  );
}
