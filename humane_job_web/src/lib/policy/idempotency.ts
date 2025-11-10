/**
 * IDEMPOTENCY ENFORCEMENT
 *
 * Prevents duplicate operations using Redis-based distributed locks.
 * Used for:
 * - Bulk letter sending (prevent double-send)
 * - Payment operations
 * - Data exports
 * - Any operation that should execute exactly once
 */

import { cacheGet, cacheSet, cacheDelete } from "@/lib/cache/redis";
import crypto from "crypto";

export interface IdempotencyOptions {
  ttlSeconds?: number; // How long to cache result (default: 24 hours)
  lockTTLSeconds?: number; // How long to hold lock (default: 5 minutes)
  resource: string; // Resource identifier (e.g., "decision:{id}")
}

export interface IdempotencyResult<T> {
  isNew: boolean; // True if this is the first execution
  result?: T; // Cached result if already executed
  lockId?: string; // Lock identifier for cleanup
}

export class IdempotencyError extends Error {
  constructor(message: string, public readonly previousResult?: any) {
    super(message);
    this.name = "IdempotencyError";
  }
}

/**
 * Enforce idempotency for an operation
 *
 * Example:
 * ```typescript
 * const result = await withIdempotency(
 *   idempotencyKey,
 *   { resource: `decision:${decisionId}` },
 *   async () => {
 *     // Operation executes only once
 *     return await sendEmail(...)
 *   }
 * );
 * ```
 */
export async function withIdempotency<T>(
  idempotencyKey: string,
  options: IdempotencyOptions,
  operation: () => Promise<T>
): Promise<T> {
  const {
    ttlSeconds = 86400, // 24 hours
    lockTTLSeconds = 300, // 5 minutes
    resource,
  } = options;

  const cacheKey = `idempotency:${idempotencyKey}`;
  const lockKey = `idempotency:lock:${idempotencyKey}`;
  const resourceLockKey = `idempotency:resource:${resource}`;

  // 1. Check if operation already completed
  const cached = await cacheGet<{ status: string; result: T; timestamp: number }>(
    cacheKey
  );

  if (cached && cached.status === "completed") {
    // Operation already completed - return cached result
    return cached.result;
  }

  // 2. Try to acquire lock
  const lockId = crypto.randomUUID();
  const lockAcquired = await acquireLock(lockKey, lockId, lockTTLSeconds);

  if (!lockAcquired) {
    // Another request is processing - wait and retry
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s

    // Check cache again
    const retryCache = await cacheGet<{ status: string; result: T }>(cacheKey);
    if (retryCache && retryCache.status === "completed") {
      return retryCache.result;
    }

    throw new IdempotencyError(
      "Operation already in progress. Please retry in a few seconds.",
      cached?.result
    );
  }

  // 3. Check resource lock (prevent concurrent operations on same resource)
  const resourceLockAcquired = await acquireLock(
    resourceLockKey,
    lockId,
    lockTTLSeconds
  );

  if (!resourceLockAcquired) {
    await releaseLock(lockKey, lockId);
    throw new IdempotencyError(
      `Resource ${resource} is locked by another operation`,
      cached?.result
    );
  }

  try {
    // 4. Mark operation as in-progress
    await cacheSet(
      cacheKey,
      {
        status: "in_progress",
        lockId,
        timestamp: Date.now(),
      },
      lockTTLSeconds
    );

    // 5. Execute operation
    const result = await operation();

    // 6. Cache result
    await cacheSet(
      cacheKey,
      {
        status: "completed",
        result,
        timestamp: Date.now(),
      },
      ttlSeconds
    );

    // 7. Release locks
    await releaseLock(lockKey, lockId);
    await releaseLock(resourceLockKey, lockId);

    return result;
  } catch (error) {
    // Operation failed - clean up and re-throw
    await cacheSet(
      cacheKey,
      {
        status: "failed",
        error: (error as Error).message,
        timestamp: Date.now(),
      },
      300 // Cache failure for 5 minutes
    );

    await releaseLock(lockKey, lockId);
    await releaseLock(resourceLockKey, lockId);

    throw error;
  }
}

/**
 * Check if an operation has already been executed
 */
export async function checkIdempotency(
  idempotencyKey: string
): Promise<IdempotencyResult<any>> {
  const cacheKey = `idempotency:${idempotencyKey}`;
  const cached = await cacheGet<{ status: string; result: any }>(cacheKey);

  if (!cached) {
    return { isNew: true };
  }

  if (cached.status === "completed") {
    return { isNew: false, result: cached.result };
  }

  if (cached.status === "in_progress") {
    throw new IdempotencyError(
      "Operation already in progress",
      cached.result
    );
  }

  if (cached.status === "failed") {
    // Allow retry after failure
    return { isNew: true };
  }

  return { isNew: true };
}

/**
 * Manually invalidate an idempotency key (admin only)
 */
export async function invalidateIdempotencyKey(
  idempotencyKey: string
): Promise<void> {
  const cacheKey = `idempotency:${idempotencyKey}`;
  await cacheDelete(cacheKey);
}

/**
 * Acquire distributed lock
 */
async function acquireLock(
  lockKey: string,
  lockId: string,
  ttlSeconds: number
): Promise<boolean> {
  const existing = await cacheGet<string>(lockKey);

  if (existing && existing !== lockId) {
    return false; // Lock held by another process
  }

  await cacheSet(lockKey, lockId, ttlSeconds);
  return true;
}

/**
 * Release distributed lock
 */
async function releaseLock(lockKey: string, lockId: string): Promise<void> {
  const existing = await cacheGet<string>(lockKey);

  if (existing === lockId) {
    await cacheDelete(lockKey);
  }
}

/**
 * Generate idempotency key from request data
 */
export function generateIdempotencyKey(
  data: any,
  prefix: string = "op"
): string {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
  return `${prefix}:${hash.substring(0, 16)}`;
}

/**
 * Middleware helper: Extract idempotency key from request headers
 */
export function extractIdempotencyKey(
  headers: Headers
): string | null {
  return headers.get("idempotency-key") || headers.get("x-idempotency-key");
}

/**
 * Validate idempotency key format (must be UUID or similar)
 */
export function validateIdempotencyKey(key: string): boolean {
  // UUID format: 8-4-4-4-12 hex digits
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Or allow custom format: prefix:hash
  const customPattern = /^[a-z0-9_-]+:[a-z0-9]{16,}$/i;

  return uuidPattern.test(key) || customPattern.test(key);
}
