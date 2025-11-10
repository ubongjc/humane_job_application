import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendRejectionLetter } from "@/lib/email/mailer";

export const dynamic = "force-dynamic";

const SendLetterSchema = z.object({
  decisionId: z.string(),
  scheduledFor: z.string().datetime().optional(),
  customSubject: z.string().optional(),
  preview: z.boolean().default(false),
});

/**
 * POST /api/letter/send
 * Send a generated rejection letter to a candidate
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = SendLetterSchema.parse(body);

    // Get user
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { company: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check permissions
    if (!["ADMIN", "HIRING_MANAGER"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get decision with related data
    const decision = await db.decision.findFirst({
      where: {
        id: data.decisionId,
        job: {
          companyId: user.companyId,
        },
      },
      include: {
        candidate: true,
        job: true,
      },
    });

    if (!decision) {
      return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    }

    if (!decision.generatedLetter) {
      return NextResponse.json(
        { error: "No letter generated for this decision" },
        { status: 400 }
      );
    }

    if (decision.sentAt) {
      return NextResponse.json(
        { error: "Letter already sent" },
        { status: 400 }
      );
    }

    // Preview mode - don't actually send
    if (data.preview) {
      return NextResponse.json({
        preview: true,
        to: decision.candidate.email,
        subject: data.customSubject || `Update on your application for ${decision.job.title}`,
        letter: decision.generatedLetter,
      });
    }

    // Send the email
    const scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : undefined;

    const result = await sendRejectionLetter({
      candidateEmail: decision.candidate.email,
      candidateName: decision.candidate.name || "Candidate",
      jobTitle: decision.job.title,
      companyName: user.company.name,
      letter: decision.generatedLetter,
      scheduledFor,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send email", details: result.error },
        { status: 500 }
      );
    }

    // Update decision record
    await db.decision.update({
      where: { id: decision.id },
      data: {
        sentAt: scheduledFor || new Date(),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "letter.sent",
        entityType: "Decision",
        entityId: decision.id,
        metadata: {
          candidateEmail: decision.candidate.email,
          jobTitle: decision.job.title,
          scheduled: !!scheduledFor,
          scheduledFor: scheduledFor?.toISOString(),
          messageId: result.messageId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      sentAt: scheduledFor || new Date(),
      messageId: result.messageId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error sending letter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
