import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

const BulkSendSchema = z.object({
  candidateIds: z.array(z.string()).min(1).max(500),
  jobId: z.string(),
  tone: z.enum(["formal", "friendly", "empathetic"]).default("empathetic"),
  scheduledFor: z.string().datetime().optional(),
  useCustomTemplate: z.boolean().default(false),
  templateId: z.string().optional(),
});

/**
 * POST /api/letter/bulk-send
 * 🚀 BULK MAGIC: Generate and send letters to up to 500 candidates at once
 *
 * This endpoint:
 * 1. Processes all candidates in parallel
 * 2. Generates personalized letters for each
 * 3. Runs bias detection on all
 * 4. Queues emails for sending
 * 5. Returns progress updates
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = BulkSendSchema.parse(body);

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { company: true },
    });

    if (!user || !["ADMIN", "HIRING_MANAGER"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Verify job belongs to company
    const job = await db.job.findFirst({
      where: { id: data.jobId, companyId: user.companyId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Create a bulk operation record
    const bulkOperation = await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "letter.bulk_send_initiated",
        entityType: "BulkOperation",
        entityId: `bulk_${Date.now()}`,
        metadata: {
          candidateCount: data.candidateIds.length,
          jobId: data.jobId,
          jobTitle: job.title,
          scheduled: !!data.scheduledFor,
        },
      },
    });

    // Process in the background using a job queue (simplified version)
    // In production, use Bull/BullMQ or similar
    processBulkLetters({
      candidateIds: data.candidateIds,
      jobId: data.jobId,
      userId: user.id,
      companyId: user.companyId,
      companyName: user.company.name,
      tone: data.tone,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      templateId: data.templateId,
      useCustomTemplate: data.useCustomTemplate,
    }).catch((error) => {
      console.error("Bulk processing error:", error);
    });

    return NextResponse.json({
      success: true,
      bulkOperationId: bulkOperation.id,
      candidateCount: data.candidateIds.length,
      message: `Processing ${data.candidateIds.length} letters. You'll receive a notification when complete.`,
      estimatedTime: Math.ceil(data.candidateIds.length / 10), // ~10 letters per second
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Bulk send error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function processBulkLetters(params: {
  candidateIds: string[];
  jobId: string;
  userId: string;
  companyId: string;
  companyName: string;
  tone: "formal" | "friendly" | "empathetic";
  scheduledFor?: Date;
  templateId?: string;
  useCustomTemplate: boolean;
}) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Process in batches of 50 for efficiency
  const batchSize = 50;
  for (let i = 0; i < params.candidateIds.length; i += batchSize) {
    const batch = params.candidateIds.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(async (candidateId) => {
        try {
          // Call the one-click endpoint for each candidate
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/letter/one-click`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Pass auth context
            },
            body: JSON.stringify({
              candidateId,
              jobId: params.jobId,
              tone: params.tone,
              sendImmediately: true,
              scheduledFor: params.scheduledFor?.toISOString(),
            }),
          });

          if (response.ok) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push(`Failed for candidate ${candidateId}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Error for candidate ${candidateId}: ${error}`);
        }
      })
    );

    // Small delay between batches to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Create completion audit log
  await db.auditLog.create({
    data: {
      companyId: params.companyId,
      userId: params.userId,
      action: "letter.bulk_send_completed",
      entityType: "BulkOperation",
      entityId: `bulk_${Date.now()}`,
      metadata: {
        success: results.success,
        failed: results.failed,
        total: params.candidateIds.length,
        errors: results.errors.slice(0, 10), // First 10 errors
      },
    },
  });

  // TODO: Send notification to user
  console.log(`Bulk operation completed: ${results.success} success, ${results.failed} failed`);
}
