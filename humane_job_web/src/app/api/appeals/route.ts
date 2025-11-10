import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

// ========================================
// Schemas
// ========================================

const CreateAppealSchema = z.object({
  decisionId: z.string().cuid(),
  question: z.string().min(10).max(1000),
  candidateEmail: z.string().email(),
});

const RespondAppealSchema = z.object({
  response: z.string().min(10).max(2000),
});

// ========================================
// GET /api/appeals
// List appeals (company-scoped, RBAC: admin/hiring_manager)
// ========================================

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user and verify permissions
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { company: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only admins and hiring managers can view appeals
    if (!["ADMIN", "HIRING_MANAGER"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") as
      | "PENDING"
      | "RESPONDED"
      | "CLOSED"
      | "EXPIRED"
      | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query
    const where: any = {
      decision: {
        job: {
          companyId: user.companyId,
        },
      },
    };

    if (status) {
      where.status = status;
    }

    // Get appeals
    const [appeals, total] = await Promise.all([
      db.appeal.findMany({
        where,
        include: {
          decision: {
            include: {
              job: { select: { title: true } },
              candidate: { select: { email: true, name: true } },
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      db.appeal.count({ where }),
    ]);

    // Check for expired appeals and update
    const now = new Date();
    const expiredAppeals = appeals.filter(
      (a) => a.status === "PENDING" && a.dueAt && a.dueAt < now
    );

    if (expiredAppeals.length > 0) {
      await db.appeal.updateMany({
        where: {
          id: { in: expiredAppeals.map((a) => a.id) },
          status: "PENDING",
        },
        data: { status: "EXPIRED" },
      });
    }

    return NextResponse.json({
      success: true,
      appeals,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching appeals:", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ========================================
// POST /api/appeals
// Create new appeal (candidate-facing, public with verification)
// ========================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = CreateAppealSchema.parse(body);

    // Verify decision exists and belongs to candidate
    const decision = await db.decision.findUnique({
      where: { id: data.decisionId },
      include: {
        candidate: true,
        job: {
          include: {
            company: {
              include: {
                users: {
                  where: { role: { in: ["ADMIN", "HIRING_MANAGER"] } },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!decision) {
      return NextResponse.json(
        { error: "Decision not found" },
        { status: 404 }
      );
    }

    // Verify candidate email matches
    if (decision.candidate.email !== data.candidateEmail) {
      return NextResponse.json(
        { error: "Email does not match decision" },
        { status: 403 }
      );
    }

    // Check if decision was sent (can't appeal unsent decisions)
    if (!decision.sentAt) {
      return NextResponse.json(
        { error: "Cannot appeal decision that has not been sent" },
        { status: 400 }
      );
    }

    // Check if appeal already exists (one per decision)
    const existingAppeal = await db.appeal.findFirst({
      where: {
        decisionId: data.decisionId,
        candidateId: decision.candidateId,
      },
    });

    if (existingAppeal) {
      return NextResponse.json(
        {
          error: "An appeal already exists for this decision",
          appealId: existingAppeal.id,
          status: existingAppeal.status,
        },
        { status: 409 }
      );
    }

    // Check if decision is too old (30 days max)
    const daysSinceSent =
      (Date.now() - decision.sentAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSent > 30) {
      return NextResponse.json(
        { error: "Appeal window has closed (30 days max)" },
        { status: 400 }
      );
    }

    // Set SLA deadline (7 days from creation)
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 7);

    // Create appeal
    const appeal = await db.appeal.create({
      data: {
        decisionId: data.decisionId,
        candidateId: decision.candidateId,
        question: data.question,
        status: "PENDING",
        dueAt,
        thread: [
          {
            timestamp: new Date().toISOString(),
            from: "candidate",
            message: data.question,
          },
        ],
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: decision.job.companyId,
        userId: null, // Candidate action
        action: "appeal.created",
        entityType: "Appeal",
        entityId: appeal.id,
        metadata: {
          decisionId: data.decisionId,
          candidateEmail: data.candidateEmail,
          jobTitle: decision.job.title,
        },
      },
    });

    // TODO: Send notification to hiring managers
    // This would integrate with the SSE notification system

    Sentry.addBreadcrumb({
      category: "appeal",
      message: "Appeal created",
      level: "info",
      data: { appealId: appeal.id, decisionId: data.decisionId },
    });

    return NextResponse.json({
      success: true,
      appealId: appeal.id,
      status: appeal.status,
      dueAt: appeal.dueAt,
      message:
        "Your clarification request has been submitted. You should receive a response within 7 days.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating appeal:", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
