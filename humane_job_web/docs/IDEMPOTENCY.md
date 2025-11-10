# Idempotency Guide

**Last Updated**: 2024-01-20
**Version**: 1.0

## Table of Contents

1. [What is Idempotency?](#what-is-idempotency)
2. [Why It Matters](#why-it-matters)
3. [How to Use](#how-to-use)
4. [Supported Endpoints](#supported-endpoints)
5. [Key Format](#key-format)
6. [Behavior & Responses](#behavior--responses)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Usage](#advanced-usage)

---

## What is Idempotency?

**Idempotency** ensures that performing the same operation multiple times has the same effect as performing it once. This is critical for preventing duplicate actions caused by network retries, user double-clicks, or webhook re-deliveries.

### Example: Sending Rejection Letters

**Without Idempotency**:
```
User clicks "Send" → Network timeout → User clicks "Send" again
Result: Candidate receives 2 identical rejection emails 😱
```

**With Idempotency**:
```
User clicks "Send" with key "abc123" → Network timeout → User clicks "Send" with key "abc123"
Result: Candidate receives 1 email ✅ (second request returns cached result)
```

---

## Why It Matters

### Problem: Network Retries

Modern HTTP clients (browsers, libraries) automatically retry failed requests. Without idempotency, retries can cause:
- **Duplicate emails** sent to candidates
- **Double charges** on credit cards
- **Duplicate database records**
- **Race conditions** in distributed systems

### Solution: Idempotency Keys

By including an `Idempotency-Key` header, clients can safely retry requests. The server will:
1. Check if the key has been seen before
2. If yes, return the **cached result** (no operation performed)
3. If no, execute the operation and cache the result

---

## How to Use

### Step 1: Generate a Key

Generate a **unique, random UUID** for each logical operation:

```typescript
import { v4 as uuidv4 } from "uuid";

const idempotencyKey = uuidv4(); // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

**Important**: Use the **same key** for retries of the **same operation**.

### Step 2: Include in Header

Add the `Idempotency-Key` header to your HTTP request:

```typescript
const response = await fetch("/api/letter/bulk-send-v2", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_TOKEN",
    "Idempotency-Key": idempotencyKey, // ✅ Include this
  },
  body: JSON.stringify({
    jobId: "job_12345",
    candidateIds: ["cand_1", "cand_2", "cand_3"],
  }),
});
```

### Step 3: Handle Response

The server will respond with one of the following:

**First Request** (operation executed):
```json
{
  "success": true,
  "bulkOperationId": "bulk_67890",
  "successCount": 3,
  "idempotent": true
}
```
Response headers: `X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000`

**Retry** (cached result):
```json
{
  "success": true,
  "bulkOperationId": "bulk_67890",
  "successCount": 3,
  "idempotent": true
}
```
Response headers:
- `X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000`
- `X-Idempotency-Replay: true` ✅ (indicates cached response)

---

## Supported Endpoints

| Endpoint | Method | Idempotency Support | TTL | Required? |
|----------|--------|---------------------|-----|-----------|
| `/api/letter/generate-v2` | POST | ✅ Yes | 24 hours | Optional |
| `/api/letter/bulk-send-v2` | POST | ✅ Yes | 24 hours | **Required** |
| `/api/letter/send` | POST | ✅ Yes | 24 hours | Optional |
| `/api/decisions` | POST | ✅ Yes | 24 hours | Optional |
| `/api/appeals` | POST | ✅ Yes | 1 hour | Optional |
| `/api/integrations/webhook` | POST | ✅ Yes | 1 hour | Recommended |
| `/api/candidates` | POST | ❌ No | N/A | N/A |
| `/api/jobs` | POST | ❌ No | N/A | N/A |

**Legend**:
- **Required**: Endpoint will reject requests without `Idempotency-Key`
- **Optional**: Endpoint accepts key but doesn't require it
- **Recommended**: Highly encouraged for webhook handlers (due to retries)

---

## Key Format

### Valid Formats

**1. UUID v4** (preferred):
```
550e8400-e29b-41d4-a716-446655440000
```

**2. Prefixed UUID** (for namespacing):
```
bulk_send:550e8400-e29b-41d4-a716-446655440000
decision:abc123-def456-789012
```

**3. Hash-based** (for deterministic keys):
```
sha256:a1b2c3d4e5f6...
md5:123abc456def...
```

### Validation Regex

```typescript
const IDEMPOTENCY_KEY_REGEX = /^[a-zA-Z0-9_:-]{16,128}$/;

function validateIdempotencyKey(key: string): boolean {
  if (!IDEMPOTENCY_KEY_REGEX.test(key)) {
    throw new Error("Invalid idempotency key format");
  }
  return true;
}
```

**Requirements**:
- **Length**: 16-128 characters
- **Characters**: `a-z`, `A-Z`, `0-9`, `_`, `-`, `:`
- **Case-sensitive**: `abc123` ≠ `ABC123`

---

## Behavior & Responses

### Lifecycle Diagram

```
┌─────────────────────────────────────────────────┐
│ Client sends request with Idempotency-Key: abc123 │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ Server checks cache │
         └─────────┬───────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
  Key exists?             Key new?
       │                       │
       │                       │
       ▼                       ▼
┌─────────────┐       ┌─────────────────┐
│ Return      │       │ Acquire lock    │
│ cached      │       │ (5 min TTL)     │
│ result      │       └────────┬────────┘
│             │                │
│ Headers:    │                ▼
│ X-Idempotency-│       ┌─────────────────┐
│ Replay: true│       │ Execute         │
└─────────────┘       │ operation       │
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │ Cache result    │
                      │ (24 hour TTL)   │
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │ Release lock    │
                      └────────┬────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │ Return result   │
                      │ Headers:        │
                      │ X-Idempotency-  │
                      │ Key: abc123     │
                      └─────────────────┘
```

### Status Codes

| Code | Meaning | Reason | Action |
|------|---------|--------|--------|
| **200 OK** | Success (first request) | Operation executed and cached | Proceed |
| **200 OK** | Success (replay) | Returned cached result | Proceed (check `X-Idempotency-Replay` header) |
| **400 Bad Request** | Invalid key format | Key doesn't match regex | Fix key format |
| **409 Conflict** | Operation in progress | Another request with same key is executing | Wait and retry in 5s |
| **423 Locked** | Resource locked | Another operation is modifying the same resource | Wait and retry in 10s |
| **500 Internal Server Error** | Operation failed | Cached for 5 minutes | Retry with same key after 5 min |

### Response Headers

| Header | Value | Meaning |
|--------|-------|---------|
| `X-Idempotency-Key` | `abc123` | Echo of the key sent by client |
| `X-Idempotency-Replay` | `true` | This is a cached response (no operation performed) |
| `X-Idempotency-Expires` | `2024-01-21T10:00:00Z` | When the cached result expires |
| `Retry-After` | `5` | Seconds to wait before retrying (409/423 errors) |

---

## Best Practices

### DO ✅

1. **Use UUIDs for Idempotency Keys**
   ```typescript
   import { v4 as uuidv4 } from "uuid";
   const key = uuidv4();
   ```

2. **Store Keys for Retries**
   ```typescript
   const key = uuidv4();
   localStorage.setItem("lastBulkSendKey", key); // Persist for retry
   ```

3. **Check for `X-Idempotency-Replay` Header**
   ```typescript
   if (response.headers.get("X-Idempotency-Replay") === "true") {
     console.log("This was a cached response, no operation performed");
   }
   ```

4. **Handle 409 Conflict (Retry)**
   ```typescript
   if (response.status === 409) {
     const retryAfter = response.headers.get("Retry-After");
     await sleep(parseInt(retryAfter) * 1000);
     return retry(); // Use SAME idempotency key
   }
   ```

5. **Namespace Keys for Different Operations**
   ```typescript
   const bulkSendKey = `bulk_send:${uuidv4()}`;
   const letterGenKey = `letter_gen:${uuidv4()}`;
   ```

6. **Log Keys for Debugging**
   ```typescript
   console.log(`Sending bulk operation with key: ${idempotencyKey}`);
   ```

### DON'T ❌

1. **Don't Reuse Keys Across Different Operations**
   ```typescript
   // ❌ BAD: Same key for different operations
   const key = uuidv4();
   await sendBulkLetters(key);
   await generateReport(key); // This will return cached bulk send result!

   // ✅ GOOD: Different keys
   const bulkKey = uuidv4();
   const reportKey = uuidv4();
   ```

2. **Don't Use Sequential Keys**
   ```typescript
   // ❌ BAD: Predictable keys
   const key = `letter_${currentTimestamp}`;

   // ✅ GOOD: Random UUIDs
   const key = uuidv4();
   ```

3. **Don't Retry with a New Key**
   ```typescript
   // ❌ BAD: New key on retry (will duplicate operation!)
   try {
     await sendLetters(uuidv4());
   } catch (error) {
     await sendLetters(uuidv4()); // New key = duplicate send!
   }

   // ✅ GOOD: Same key on retry
   const key = uuidv4();
   try {
     await sendLetters(key);
   } catch (error) {
     await sendLetters(key); // Same key = idempotent
   }
   ```

4. **Don't Assume Immediate Consistency**
   ```typescript
   // ❌ BAD: Expect instant replay
   await sendLetters(key);
   await sendLetters(key); // Might get 409 if first request still processing

   // ✅ GOOD: Handle 409 with retry
   await sendLetters(key);
   try {
     await sendLetters(key);
   } catch (error) {
     if (error.status === 409) {
       await sleep(5000);
       await sendLetters(key); // Retry after 5s
     }
   }
   ```

5. **Don't Ignore TTL Expiration**
   ```typescript
   // ❌ BAD: Reuse expired key (24 hours later)
   const key = localStorage.getItem("oldKey"); // From yesterday
   await sendLetters(key); // This WILL execute again (cache expired)

   // ✅ GOOD: Generate new key after expiration
   const key = uuidv4();
   localStorage.setItem("currentKey", key);
   localStorage.setItem("keyTimestamp", Date.now());
   ```

---

## Troubleshooting

### Issue 1: Getting 409 Conflict on Retry

**Symptom**:
```json
{
  "error": "Operation already in progress",
  "idempotencyKey": "abc123"
}
```

**Cause**: The first request is still being processed (lock not released yet).

**Solution**:
1. Wait for the `Retry-After` duration (typically 5-10 seconds)
2. Retry with the **same** idempotency key
3. If 409 persists after 3 retries, check operation status:

```typescript
const status = await fetch(`/api/operations/bulk-send?idempotencyKey=${key}`);
```

---

### Issue 2: Getting 423 Locked

**Symptom**:
```json
{
  "error": "Resource job_12345 is locked by another operation"
}
```

**Cause**: Another operation is currently modifying the same job/candidate.

**Solution**:
1. Wait 10-30 seconds for the other operation to complete
2. Retry with the **same** idempotency key
3. If the issue persists, check if there's a stuck operation:

```typescript
const operations = await fetch(`/api/operations?jobId=job_12345&status=PROCESSING`);
```

---

### Issue 3: Cached Result is Incorrect

**Symptom**: Retrying a request returns the wrong result.

**Cause**: You reused an idempotency key from a previous operation.

**Solution**:
1. Generate a **new** idempotency key for the new operation
2. Never reuse keys across different logical operations
3. Namespace your keys to avoid collisions:

```typescript
const key1 = `bulk_send:job_12345:${uuidv4()}`;
const key2 = `bulk_send:job_67890:${uuidv4()}`; // Different job
```

---

### Issue 4: Operation Executed Twice Despite Idempotency Key

**Possible Causes**:
1. **Used different keys**: Check logs to verify the same key was sent
2. **Cache expired**: If you retry after 24 hours, the cache is gone
3. **Server restarted**: Redis cache was cleared (rare)

**Debug Steps**:
```typescript
// Check server logs
console.log(response.headers.get("X-Idempotency-Key")); // Should match your key
console.log(response.headers.get("X-Idempotency-Replay")); // Should be "true" on retry

// Verify key consistency
const key = uuidv4();
console.log(`Sending with key: ${key}`);
const response1 = await send(key);
console.log(`Retrying with key: ${key}`);
const response2 = await send(key); // Should have X-Idempotency-Replay: true
```

---

## Advanced Usage

### Conditional Idempotency

Some operations are naturally idempotent (e.g., GET requests, setting a value to a specific state). For these, idempotency keys are **optional**:

```typescript
// Example: Update job status to "closed"
await fetch("/api/jobs/job_12345", {
  method: "PATCH",
  body: JSON.stringify({ status: "closed" }),
  // No idempotency key needed (setting to same value is idempotent)
});
```

However, for **state transitions** (e.g., "open" → "closed"), idempotency keys are **recommended**:

```typescript
// Example: Transition job from "open" to "closed"
await fetch("/api/jobs/job_12345/close", {
  method: "POST",
  headers: { "Idempotency-Key": uuidv4() }, // ✅ Recommended
});
```

---

### Idempotency for Webhooks

Webhook providers (ATS systems like Greenhouse, Lever) may re-deliver the same event multiple times. To prevent duplicate processing:

**1. Extract Event ID from Webhook Payload**:
```typescript
const eventId = payload.event_id; // e.g., "gh_event_12345"
```

**2. Use Event ID as Idempotency Key**:
```typescript
await processWebhook(payload, {
  idempotencyKey: `webhook:${payload.source}:${eventId}`,
});
```

**3. Check for Replay**:
```typescript
export async function processWebhook(payload: any, options: { idempotencyKey: string }) {
  return withIdempotency(options.idempotencyKey, { ttlSeconds: 3600 }, async () => {
    // Process event (only executed once per event ID)
    await db.candidate.update({
      where: { externalId: payload.candidate_id },
      data: { status: payload.status },
    });
  });
}
```

---

### Distributed Locking (Resource-Level)

For operations that modify shared resources (e.g., job openings, candidates), we use **resource-level locks** to prevent race conditions:

**Example**: Prevent concurrent bulk sends for the same job

```typescript
export async function bulkSend(jobId: string, candidateIds: string[], idempotencyKey: string) {
  return withIdempotency(
    idempotencyKey,
    {
      resource: `job:${jobId}`, // ✅ Lock at job level
      ttlSeconds: 86400, // 24 hours for result cache
      lockTTLSeconds: 600, // 10 minutes for lock
    },
    async () => {
      // Only one bulk send per job can execute at a time
      return performBulkSend(jobId, candidateIds);
    }
  );
}
```

**Behavior**:
- If another request tries to bulk send for the **same job** while the first is processing, it gets a `423 Locked` error.
- If another request tries to bulk send for a **different job**, it proceeds normally (different lock).

---

### Checking Operation Status

For long-running operations, clients can check status without idempotency keys:

**Endpoint**: `GET /api/operations/bulk-send?idempotencyKey=abc123`

**Response**:
```json
{
  "id": "bulk_67890",
  "status": "PROCESSING", // or "COMPLETED", "FAILED", "PARTIAL"
  "progress": {
    "total": 500,
    "completed": 350,
    "failed": 5
  },
  "idempotencyKey": "abc123",
  "createdAt": "2024-01-20T10:00:00Z",
  "completedAt": null
}
```

**Use Case**: Polling for completion without retrying the original request.

---

### Idempotency Key Expiration

**Default TTL**: 24 hours

After expiration, retrying with the same key will **execute the operation again**. This is by design to allow:
1. Fixing mistakes (e.g., wrong candidate list)
2. Re-sending after a long delay

**Custom TTL** (for specific endpoints):
```typescript
// Example: Appeals have 1-hour TTL (expect quick retries only)
await withIdempotency(
  idempotencyKey,
  { ttlSeconds: 3600 }, // 1 hour
  async () => {
    return createAppeal(data);
  }
);
```

---

## FAQ

### Q: Can I use the same idempotency key across different endpoints?

**A**: No. Each endpoint has its own cache namespace. The same key for `/api/letter/send` and `/api/letter/bulk-send` will not collide.

### Q: What happens if the server restarts?

**A**: Idempotency cache is stored in **Redis**, which persists across restarts. However, if Redis is cleared, cache will be lost.

### Q: How do I force re-execution?

**A**: Generate a **new** idempotency key. The server has no "force" option to prevent accidental duplicates.

### Q: Do GET requests need idempotency keys?

**A**: No. GET requests are naturally idempotent (reading data multiple times has no side effects).

### Q: What if I lose my idempotency key?

**A**: Check the operation status via the operations API (`GET /api/operations/bulk-send?jobId=job_12345`). If the operation completed, you can fetch the result. If not, you'll need to generate a **new** key and start over.

---

## Implementation Details

### Server-Side Code

**File**: `src/lib/policy/idempotency.ts`

```typescript
export async function withIdempotency<T>(
  idempotencyKey: string,
  options: IdempotencyOptions,
  operation: () => Promise<T>
): Promise<T> {
  const { ttlSeconds = 86400, lockTTLSeconds = 300, resource } = options;

  // 1. Check cache
  const cached = await redis.get(`idempotency:${idempotencyKey}`);
  if (cached) {
    return JSON.parse(cached); // Return cached result
  }

  // 2. Acquire lock
  const lockAcquired = await redis.set(
    `idempotency:lock:${idempotencyKey}`,
    "1",
    "EX",
    lockTTLSeconds,
    "NX"
  );
  if (!lockAcquired) {
    throw new ConflictError("Operation already in progress");
  }

  // 3. Check resource lock (if specified)
  if (resource) {
    const resourceLockAcquired = await redis.set(
      `idempotency:resource:${resource}`,
      "1",
      "EX",
      lockTTLSeconds,
      "NX"
    );
    if (!resourceLockAcquired) {
      await redis.del(`idempotency:lock:${idempotencyKey}`);
      throw new LockedError(`Resource ${resource} is locked`);
    }
  }

  try {
    // 4. Execute operation
    const result = await operation();

    // 5. Cache result
    await redis.set(
      `idempotency:${idempotencyKey}`,
      JSON.stringify(result),
      "EX",
      ttlSeconds
    );

    // 6. Release locks
    await redis.del(`idempotency:lock:${idempotencyKey}`);
    if (resource) {
      await redis.del(`idempotency:resource:${resource}`);
    }

    return result;
  } catch (error) {
    // Cache failure for 5 minutes (prevent retry storm)
    await redis.set(
      `idempotency:${idempotencyKey}`,
      JSON.stringify({ error: error.message }),
      "EX",
      300
    );

    // Release locks
    await redis.del(`idempotency:lock:${idempotencyKey}`);
    if (resource) {
      await redis.del(`idempotency:resource:${resource}`);
    }

    throw error;
  }
}
```

---

## Conclusion

Idempotency is a critical feature for building reliable, production-grade APIs. By following this guide, you can:
- ✅ Prevent duplicate operations (emails, charges, records)
- ✅ Safely retry failed requests
- ✅ Handle webhook re-deliveries
- ✅ Avoid race conditions in distributed systems

**Key Takeaway**: Always use idempotency keys for state-changing operations, and **never** change the key on retry.

For questions or issues, contact: **eng@humanejob.com**
