import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const RespondSchema = z.object({
  response: z.string().min(10).max(2000),
  cannedResponseId: z.string().optional(),
});

// Canned responses for common clarifications
const CANNED_RESPONSES: Record<string, string> = {
  timeline: `Thank you for your question. The hiring timeline for this position was driven by immediate business needs. We selected the candidate whose skills and experience most closely aligned with our specific requirements at this time. We encourage you to continue developing your skills and apply for future opportunities.`,

  feedback_detail: `Thank you for requesting additional feedback. The structured rubric scores provided in your rejection letter represent the comprehensive evaluation from our interview process. Each criterion was assessed objectively based on job-related requirements. We're unable to provide additional subjective commentary beyond what was shared.`,

  reconsideration: `Thank you for your continued interest. Our hiring decisions are final once communicated. However, we encourage you to apply for future positions that match your qualifications. Each application receives fresh consideration based on the specific role requirements.`,

  interview_process: `Thank you for your question about our interview process. All candidates for this position completed the same structured interview process with consistent evaluation criteria. Decisions were based solely on job-related qualifications as assessed through this standardized process.`,

  next_steps: `Thank you for your interest in future opportunities. We recommend monitoring our careers page for positions that match your background. When you see a relevant opening, please submit a new application. Each application is reviewed independently based on the specific role requirements.`,
};

/**
 * POST /api/appeals/[id]/respond
 * Respond to an appeal (RBAC: admin/hiring_manager only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appealId = params.id;
    const body = await req.json();
    const data = RespondSchema.parse(body);

    // Get user and verify permissions
    const user = await db.user.findUnique({
      where: { clerkId: userId },
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

    // Get appeal with decision info
    const appeal = await db.appeal.findUnique({
      where: { id: appealId },
      include: {
        decision: {
          include: {
            job: true,
            candidate: true,
          },
        },
      },
    });

    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }

    // Verify appeal belongs to user's company
    if (appeal.decision.job.companyId !== user.companyId) {
      return NextResponse.json(
        { error: "Appeal not found" },
        { status: 404 }
      );
    }

    // Check if appeal is already responded to
    if (appeal.status === "RESPONDED" || appeal.status === "CLOSED") {
      return NextResponse.json(
        { error: "Appeal has already been responded to" },
        { status: 400 }
      );
    }

    // Check if appeal is expired
    if (appeal.status === "EXPIRED") {
      return NextResponse.json(
        { error: "Appeal has expired" },
        { status: 400 }
      );
    }

    // Use canned response if specified
    let responseText = data.response;
    if (data.cannedResponseId && CANNED_RESPONSES[data.cannedResponseId]) {
      responseText = CANNED_RESPONSES[data.cannedResponseId];
    }

    // Update thread
    const currentThread = (appeal.thread as any[]) || [];
    const updatedThread = [
      ...currentThread,
      {
        timestamp: new Date().toISOString(),
        from: "company",
        message: responseText,
        respondedBy: user.id,
      },
    ];

    // Update appeal
    const updatedAppeal = await db.appeal.update({
      where: { id: appealId },
      data: {
        status: "RESPONDED",
        response: responseText,
        respondedBy: user.id,
        thread: updatedThread,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "appeal.responded",
        entityType: "Appeal",
        entityId: appeal.id,
        metadata: {
          candidateEmail: appeal.decision.candidate.email,
          responseLength: responseText.length,
          cannedResponseId: data.cannedResponseId,
        },
      },
    });

    // TODO: Send email notification to candidate
    // This would integrate with the email system

    Sentry.addBreadcrumb({
      category: "appeal",
      message: "Appeal responded",
      level: "info",
      data: {
        appealId: appeal.id,
        respondedBy: user.id,
        usedCannedResponse: !!data.cannedResponseId,
      },
    });

    return NextResponse.json({
      success: true,
      appeal: updatedAppeal,
      message: "Response sent to candidate",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error responding to appeal:", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/appeals/[id]/canned-responses
 * Get available canned responses
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return canned responses
    const responses = Object.entries(CANNED_RESPONSES).map(([id, text]) => ({
      id,
      text,
      preview: text.substring(0, 100) + "...",
    }));

    return NextResponse.json({
      success: true,
      responses,
    });
  } catch (error) {
    console.error("Error fetching canned responses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
