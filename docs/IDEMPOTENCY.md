# Idempotency Guide

## Overview

Idempotency ensures that duplicate requests produce the same result without side effects. This document explains how to use idempotency keys in the Humane Job Application platform.

---

## Table of Contents

1. [What is Idempotency?](#what-is-idempotency)
2. [Why It Matters](#why-it-matters)
3. [How to Use](#how-to-use)
4. [API Endpoints](#api-endpoints)
5. [Key Format](#key-format)
6. [Behavior & Responses](#behavior--responses)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## What is Idempotency?

**Definition:** An operation is **idempotent** if performing it multiple times has the same effect as performing it once.

**Example:**
```
// Idempotent
PUT /api/user/123 { name: "John" }  → Updates user
PUT /api/user/123 { name: "John" }  → Updates user (same result)

// NOT Idempotent
POST /api/emails/send { to: "john@example.com" }  → Sends email
POST /api/emails/send { to: "john@example.com" }  → Sends ANOTHER email ❌
```

**Solution:** Use idempotency keys!

```
POST /api/emails/send
Headers: Idempotency-Key: abc-123
Body: { to: "john@example.com" }
→ Sends email

POST /api/emails/send
Headers: Idempotency-Key: abc-123
Body: { to: "john@example.com" }
→ Returns cached result (no duplicate send) ✅
```

---

## Why It Matters

### Problems Without Idempotency

1. **Double-Sends:**
   - User clicks "Send" button twice → 2 rejection emails sent ❌

2. **Double-Charges:**
   - Payment request retried → User charged twice ❌

3. **Duplicate Records:**
   - Network timeout → Client retries → 2 candidates created ❌

4. **Race Conditions:**
   - Two admins click "Generate Letter" simultaneously → 2 letters created ❌

### Benefits With Idempotency

1. ✅ **Safe Retries:** Client can retry failed requests without fear
2. ✅ **Fault Tolerance:** Handles network issues gracefully
3. ✅ **Concurrency Control:** Prevents duplicate operations
4. ✅ **Audit Trail:** Easy to track duplicate attempts

---

## How to Use

### Step 1: Generate Idempotency Key

**Client-Side (TypeScript):**
```typescript
import { v4 as uuidv4 } from 'uuid';

const idempotencyKey = uuidv4();
// Example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

**Alternative (Hash-Based):**
```typescript
import crypto from 'crypto';

function generateIdempotencyKey(data: any): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .substring(0, 16);

  return `bulk-send:${hash}`;
  // Example: "bulk-send:a1b2c3d4e5f6g7h8"
}
```

### Step 2: Include in Request

**HTTP Header:**
```bash
curl -X POST https://api.humane-job.com/api/letter/bulk-send-v2 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Idempotency-Key: f47ac10b-58cc-4372-a567-0e02b2c3d479" \
  -H "Content-Type: application/json" \
  -d '{
    "candidateIds": ["cand_1", "cand_2"],
    "jobId": "job_123"
  }'
```

**JavaScript (fetch):**
```javascript
const response = await fetch('/api/letter/bulk-send-v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  },
  body: JSON.stringify({
    candidateIds: ['cand_1', 'cand_2'],
    jobId: 'job_123',
  }),
});
```

### Step 3: Handle Response

**First Request (New Operation):**
```json
{
  "success": true,
  "bulkOperationId": "bulk_123",
  "candidateCount": 2,
  "successCount": 2,
  "errorCount": 0,
  "duration": 1234,
  "idempotent": true
}
```

**Duplicate Request (Cached Result):**
```json
{
  "success": true,
  "bulkOperationId": "bulk_123",
  "candidateCount": 2,
  "successCount": 2,
  "errorCount": 0,
  "duration": 1234,
  "idempotent": true,
  "cached": true   // ← Indicates cached response
}
```

**Conflict (Operation In Progress):**
```json
{
  "error": "Operation already in progress. Please retry in a few seconds.",
  "hint": "Check the result using the same idempotency key."
}

Status: 409 Conflict
```

---

## API Endpoints

### Supported Endpoints

| Endpoint | Required Header | TTL | Purpose |
|----------|----------------|-----|---------|
| `POST /api/letter/bulk-send-v2` | `Idempotency-Key` | 24h | Prevent double-send |
| `POST /api/letter/generate-v2` | Optional | 1h | Prevent duplicate letter generation |
| `POST /api/batch/import` | `Idempotency-Key` | 24h | Prevent duplicate CSV imports |
| `POST /api/webhooks/stripe` | Auto (Stripe-provided) | 24h | Prevent duplicate payment processing |

### Endpoint Details

#### POST /api/letter/bulk-send-v2

**Purpose:** Send rejection letters to multiple candidates.

**Idempotency Key:** **Required**

**Behavior:**
1. First request: Sends all letters, stores result
2. Duplicate request (within 24h): Returns cached result, no emails sent
3. After 24h: Key expires, operation allowed again

**Example:**
```bash
curl -X POST /api/letter/bulk-send-v2 \
  -H "Idempotency-Key: bulk-send-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{
    "candidateIds": ["cand_1", "cand_2", "cand_3"],
    "jobId": "job_123",
    "scheduledFor": "2024-01-25T10:00:00Z"
  }'
```

#### POST /api/letter/generate-v2

**Purpose:** Generate a single rejection letter.

**Idempotency Key:** Optional (but recommended)

**Behavior:**
- If provided: Cached for 1 hour
- If omitted: No caching (regenerates on each request)

**Example:**
```bash
curl -X POST /api/letter/generate-v2 \
  -H "Idempotency-Key: letter-gen-$(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "candidateId": "cand_123",
    "jobId": "job_456",
    "outcome": "REJECTED",
    "tone": "empathetic"
  }'
```

---

## Key Format

### Valid Formats

**UUID (Recommended):**
```
f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Custom (Prefix + Hash):**
```
bulk-send:a1b2c3d4e5f6g7h8
letter-gen:9i8j7k6l5m4n3o2p
import-csv:1q2w3e4r5t6y7u8i
```

### Validation Rules

```typescript
// UUID format: 8-4-4-4-12 hex digits
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Custom format: prefix:hash (16+ chars)
const customPattern = /^[a-z0-9_-]+:[a-z0-9]{16,}$/i;
```

**Valid:**
- ✅ `f47ac10b-58cc-4372-a567-0e02b2c3d479`
- ✅ `bulk-send:a1b2c3d4e5f6g7h8`
- ✅ `my-operation:123abc456def789ghi`

**Invalid:**
- ❌ `short-key` (too short)
- ❌ `CAPITAL-KEY:ABC123` (uppercase not allowed)
- ❌ `key with spaces` (spaces not allowed)
- ❌ `special!chars@here` (special chars not allowed)

---

## Behavior & Responses

### Request Lifecycle

```
┌──────────────────────────────────────────────────┐
│ 1. Client generates idempotency key              │
└──────────────┬───────────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────────┐
│ 2. Server checks Redis cache                     │
│    - Key exists? → Return cached result (200)    │
│    - Key doesn't exist? → Continue to step 3     │
└──────────────┬───────────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────────┐
│ 3. Acquire distributed lock                      │
│    - Lock acquired? → Continue to step 4         │
│    - Lock held by another request? → 409 Conflict│
└──────────────┬───────────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────────┐
│ 4. Execute operation                             │
│    - Send emails, update database, etc.          │
└──────────────┬───────────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────────┐
│ 5. Cache result (TTL: 24 hours)                  │
│    - Store in Redis with idempotency key         │
└──────────────┬───────────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────────┐
│ 6. Release lock                                  │
│    - Allow other requests to proceed             │
└──────────────┬───────────────────────────────────┘
               │
               v
┌──────────────────────────────────────────────────┐
│ 7. Return response (200 OK)                      │
└──────────────────────────────────────────────────┘
```

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| `200 OK` | Operation completed (first time or cached) | Success |
| `409 Conflict` | Operation already in progress | Retry in 1-5 seconds |
| `400 Bad Request` | Missing or invalid idempotency key | Fix key format |
| `500 Internal Server Error` | Operation failed | Check logs, retry with same key |

### Response Headers

```
X-Idempotency-Key: f47ac10b-58cc-4372-a567-0e02b2c3d479
X-Idempotency-Cached: true
X-Idempotency-TTL: 86400
```

---

## Best Practices

### DO ✅

1. **Generate Keys Client-Side:**
   ```javascript
   const idempotencyKey = uuidv4();
   ```

2. **Use Same Key for Retries:**
   ```javascript
   async function sendWithRetry(data, maxRetries = 3) {
     const idempotencyKey = uuidv4();

     for (let i = 0; i < maxRetries; i++) {
       try {
         return await send(data, idempotencyKey);
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await sleep(1000 * (i + 1)); // Exponential backoff
       }
     }
   }
   ```

3. **Store Keys Locally:**
   ```javascript
   localStorage.setItem('bulk-send-key', idempotencyKey);
   // Can retrieve later if network fails
   ```

4. **Use Descriptive Prefixes:**
   ```javascript
   const key = `bulk-send-${jobId}-${timestamp}`;
   ```

5. **Check Cached Responses:**
   ```javascript
   if (response.cached) {
     console.log('Operation already completed');
   }
   ```

### DON'T ❌

1. **Don't Reuse Keys Across Operations:**
   ```javascript
   // ❌ BAD
   const globalKey = uuidv4();
   await sendBulk(data1, globalKey);
   await sendBulk(data2, globalKey); // WRONG!

   // ✅ GOOD
   await sendBulk(data1, uuidv4());
   await sendBulk(data2, uuidv4());
   ```

2. **Don't Use Timestamps as Keys:**
   ```javascript
   // ❌ BAD (clock skew issues)
   const key = Date.now().toString();

   // ✅ GOOD
   const key = uuidv4();
   ```

3. **Don't Include Sensitive Data:**
   ```javascript
   // ❌ BAD
   const key = `send-${candidateEmail}`;

   // ✅ GOOD
   const key = `send-${candidateId}`;
   ```

4. **Don't Ignore 409 Conflicts:**
   ```javascript
   // ❌ BAD
   if (response.status === 409) {
     // Give up immediately
   }

   // ✅ GOOD
   if (response.status === 409) {
     await sleep(2000);
     return retry(request, idempotencyKey);
   }
   ```

---

## Troubleshooting

### Issue: "Idempotency-Key header required"

**Cause:** Header missing or misspelled.

**Solution:**
```javascript
// Check header name (case-insensitive, but use this format)
headers: {
  'Idempotency-Key': 'your-key-here', // ✅
  // NOT: 'idempotency-key', 'IdempotencyKey', etc.
}
```

### Issue: "Invalid idempotency key format"

**Cause:** Key doesn't match UUID or custom format.

**Solution:**
```javascript
// Use UUID library
import { v4 as uuidv4 } from 'uuid';
const key = uuidv4(); // ✅

// OR custom format
const key = `bulk-send:${crypto.randomBytes(16).toString('hex')}`; // ✅
```

### Issue: "Operation already in progress" (409)

**Cause:** Another request with the same key is currently executing.

**Solution:**
```javascript
async function sendWithRetry(data, key, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch('/api/bulk-send-v2', {
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(data),
    });

    if (response.status === 409) {
      // Wait and retry
      await sleep(1000 * (i + 1)); // 1s, 2s, 3s, 4s, 5s
      continue;
    }

    return response;
  }

  throw new Error('Operation timed out');
}
```

### Issue: Cached Result is Outdated

**Cause:** You want to re-run the operation, but the key is still cached.

**Solution:**
```javascript
// Option 1: Use a new key
const newKey = uuidv4();

// Option 2: Wait for TTL to expire (24 hours)

// Option 3: Admin invalidation (requires admin access)
await fetch('/api/admin/idempotency/invalidate', {
  method: 'POST',
  body: JSON.stringify({ key: oldKey }),
});
```

### Issue: Different Results for Same Key

**Cause:** Request body changed between requests.

**Behavior:** Server returns **cached result**, not a new result!

```javascript
// First request
await send({ candidateIds: ['c1', 'c2'] }, 'key-123');
// Result: Sent to c1, c2

// Second request (DIFFERENT data, SAME key)
await send({ candidateIds: ['c3', 'c4'] }, 'key-123');
// Result: Returns cached result (c1, c2), NOT c3, c4! ⚠️
```

**Solution:** Use a different key for different data!

```javascript
const key1 = `bulk-send:${hash(data1)}`;
const key2 = `bulk-send:${hash(data2)}`;
```

---

## Advanced Usage

### Conditional Idempotency

```javascript
// Only use idempotency for critical operations
const idempotencyKey = isCritical ? uuidv4() : undefined;

await fetch('/api/letter/generate-v2', {
  headers: {
    ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
  },
});
```

### Idempotency with Webhooks

```javascript
// Stripe automatically provides idempotency
app.post('/webhooks/stripe', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const idempotencyKey = req.headers['stripe-idempotency-key'];

  // Process webhook (Stripe ensures each event is delivered once)
});
```

### Bulk Operation Status Check

```javascript
// Get status of bulk operation by idempotency key
const status = await fetch(
  `/api/letter/bulk-send-v2?idempotencyKey=${key}`
);

const { bulkOperation } = await status.json();
console.log(bulkOperation.status); // PENDING, PROCESSING, COMPLETED, FAILED
```

---

## Resources

- **RFC 7231 (Idempotency):** https://tools.ietf.org/html/rfc7231#section-4.2.2
- **Stripe Idempotency:** https://stripe.com/docs/api/idempotent_requests
- **UUID RFC:** https://tools.ietf.org/html/rfc4122

---

## Contact

**API Questions:** api@humane-job.com
**Technical Support:** support@humane-job.com
