import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { withIdempotency, extractIdempotencyKey, validateIdempotencyKey } from "@/lib/policy/idempotency";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const BulkSendSchema = z.object({
  candidateIds: z.array(z.string()).min(1).max(500),
  jobId: z.string(),
  scheduledFor: z.string().datetime().optional(),
});

/**
 * POST /api/letter/bulk-send-v2
 *
 * Send letters in bulk with idempotency guarantees.
 *
 * Features:
 * - Idempotent (duplicate requests with same key return cached result)
 * - Resource locking (prevents concurrent sends for same candidates)
 * - Batch processing (50 per batch)
 * - Error aggregation (first 10 errors)
 * - Progress tracking via BulkOperation model
 *
 * Headers:
 * - Idempotency-Key: UUID or custom key (required)
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract idempotency key from headers
    const idempotencyKey = extractIdempotencyKey(req.headers);
    if (!idempotencyKey) {
      return NextResponse.json(
        {
          error: "Idempotency-Key header required",
          hint: "Add header: Idempotency-Key: <uuid>",
        },
        { status: 400 }
      );
    }

    if (!validateIdempotencyKey(idempotencyKey)) {
      return NextResponse.json(
        {
          error: "Invalid idempotency key format",
          hint: "Must be UUID or format: prefix:hash",
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = BulkSendSchema.parse(body);

    // Get user and verify permissions
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { company: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!["ADMIN", "HIRING_MANAGER"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Verify job exists and belongs to company
    const job = await db.job.findFirst({
      where: {
        id: data.jobId,
        companyId: user.companyId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Execute with idempotency
    const result = await withIdempotency(
      idempotencyKey,
      {
        resource: `bulk-send:${data.jobId}`,
        ttlSeconds: 86400, // Cache for 24 hours
        lockTTLSeconds: 600, // Lock for 10 minutes (long operation)
      },
      async () => {
        // Create bulk operation record
        const bulkOp = await db.bulkOperation.create({
          data: {
            companyId: user.companyId,
            authorId: user.id,
            type: "LETTER_SEND",
            idempotencyKey,
            candidateCount: data.candidateIds.length,
            status: "PROCESSING",
            metadata: {
              jobId: data.jobId,
              jobTitle: job.title,
              scheduledFor: data.scheduledFor,
            },
          },
        });

        const errors: Array<{ candidateId: string; error: string }> = [];
        let successCount = 0;

        // Process in batches of 50
        const BATCH_SIZE = 50;
        for (let i = 0; i < data.candidateIds.length; i += BATCH_SIZE) {
          const batch = data.candidateIds.slice(i, i + BATCH_SIZE);

          const results = await Promise.allSettled(
            batch.map(async (candidateId) => {
              try {
                // Get decision for candidate
                const decision = await db.decision.findFirst({
                  where: {
                    candidateId,
                    jobId: data.jobId,
                    sentAt: null, // Only send if not already sent
                  },
                });

                if (!decision) {
                  throw new Error("No unsent decision found for candidate");
                }

                // Update decision as sent
                await db.decision.update({
                  where: { id: decision.id },
                  data: {
                    sentAt: data.scheduledFor
                      ? new Date(data.scheduledFor)
                      : new Date(),
                  },
                });

                // TODO: Actually send email via mailer
                // await sendEmail(decision, candidate, job);

                return { success: true, candidateId };
              } catch (error) {
                throw {
                  candidateId,
                  error: (error as Error).message,
                };
              }
            })
          );

          // Aggregate results
          results.forEach((result) => {
            if (result.status === "fulfilled") {
              successCount++;
            } else {
              const err = result.reason;
              if (errors.length < 10) {
                // Keep first 10 errors
                errors.push(err);
              }
            }
          });
        }

        const errorCount = data.candidateIds.length - successCount;

        // Update bulk operation
        await db.bulkOperation.update({
          where: { id: bulkOp.id },
          data: {
            status:
              errorCount === 0
                ? "COMPLETED"
                : successCount > 0
                  ? "PARTIAL"
                  : "FAILED",
            successCount,
            errorCount,
            errors: errors.length > 0 ? errors : null,
            completedAt: new Date(),
          },
        });

        // Audit log
        await db.auditLog.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            action: "bulk_send.completed",
            entityType: "BulkOperation",
            entityId: bulkOp.id,
            metadata: {
              jobId: data.jobId,
              candidateCount: data.candidateIds.length,
              successCount,
              errorCount,
              idempotencyKey,
            },
          },
        });

        return {
          bulkOperationId: bulkOp.id,
          candidateCount: data.candidateIds.length,
          successCount,
          errorCount,
          errors: errors.length > 0 ? errors : undefined,
          duration: Date.now() - startTime,
        };
      }
    );

    Sentry.addBreadcrumb({
      category: "bulk_operation",
      message: "Bulk send completed",
      level: "info",
      data: {
        idempotencyKey,
        candidateCount: data.candidateIds.length,
        successCount: result.successCount,
        errorCount: result.errorCount,
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
      idempotent: true,
    });
  } catch (error: any) {
    // Check if this is an idempotency error
    if (error.name === "IdempotencyError") {
      return NextResponse.json(
        {
          error: error.message,
          hint: "Operation already in progress or completed. Check the result using the same idempotency key.",
          previousResult: error.previousResult,
        },
        { status: 409 } // Conflict
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error in bulk send:", error);
    Sentry.captureException(error, {
      tags: { source: "bulk_send_v2" },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/letter/bulk-send-v2
 *
 * Check status of bulk operation by idempotency key.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const idempotencyKey = searchParams.get("idempotencyKey");

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "idempotencyKey query parameter required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find bulk operation
    const bulkOp = await db.bulkOperation.findFirst({
      where: {
        idempotencyKey,
        companyId: user.companyId,
      },
    });

    if (!bulkOp) {
      return NextResponse.json(
        { error: "Bulk operation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      bulkOperation: bulkOp,
    });
  } catch (error) {
    console.error("Error fetching bulk operation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
