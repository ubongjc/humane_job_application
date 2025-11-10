import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { generateRejectionLetter, generateFeedbackSuggestions } from "@/lib/ai/openai";
import { sendRejectionLetter } from "@/lib/email/mailer";
import { withRateLimit, strictRateLimiter } from "@/lib/security/rate-limit";

const OneClickSchema = z.object({
  candidateId: z.string(),
  jobId: z.string(),
  tone: z.enum(["formal", "friendly", "empathetic"]).default("empathetic"),
  sendImmediately: z.boolean().default(false),
  scheduledFor: z.string().datetime().optional(),
});

/**
 * POST /api/letter/one-click
 * ⚡ MAGIC BUTTON: Generate, review, and optionally send letter in ONE click
 *
 * This endpoint:
 * 1. Analyzes interview notes
 * 2. Generates AI feedback
 * 3. Creates humane letter
 * 4. Runs bias detection
 * 5. Optionally sends email
 *
 * All in < 3 seconds!
 */
export async function POST(req: NextRequest) {
  // Rate limit check
  const rateLimitResponse = await withRateLimit(req, strictRateLimiter, 10);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = OneClickSchema.parse(body);

    // Get user with company
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

    // Get job and candidate in parallel
    const [job, candidate] = await Promise.all([
      db.job.findFirst({
        where: { id: data.jobId, companyId: user.companyId },
      }),
      db.candidate.findFirst({
        where: { id: data.candidateId, jobId: data.jobId },
      }),
    ]);

    if (!job || !candidate) {
      return NextResponse.json(
        { error: "Job or candidate not found" },
        { status: 404 }
      );
    }

    // Step 1: Get interview notes and generate smart feedback
    const notes = await db.interviewNote.findMany({
      where: {
        jobId: data.jobId,
        candidateEmail: candidate.email,
      },
    });

    let reasons: string[] = [];

    if (notes.length > 0 && job.rubric) {
      // Aggregate scores across all interviews
      const aggregatedScores: Record<string, number> = {};
      notes.forEach((note) => {
        const scores = note.structuredScores as Record<string, number>;
        Object.entries(scores).forEach(([criterion, score]) => {
          if (!aggregatedScores[criterion]) {
            aggregatedScores[criterion] = 0;
          }
          aggregatedScores[criterion] += score;
        });
      });

      // Average the scores
      Object.keys(aggregatedScores).forEach((key) => {
        aggregatedScores[key] = aggregatedScores[key] / notes.length;
      });

      // Generate AI-powered feedback suggestions
      reasons = await generateFeedbackSuggestions(
        job.rubric as Record<string, any>,
        aggregatedScores
      );
    }

    // Fallback to generic feedback if no notes
    if (reasons.length === 0) {
      reasons = [
        "While your qualifications are strong, we've decided to move forward with candidates whose experience more closely aligns with our current needs.",
      ];
    }

    // Step 2: Generate the letter
    const letterResult = await generateRejectionLetter({
      candidateName: candidate.name || "Candidate",
      jobTitle: job.title,
      companyName: user.company.name,
      reasons,
      jurisdiction: job.jurisdiction as "US" | "EU" | "CA",
      tone: data.tone,
    });

    // If bias check failed, return immediately
    if (!letterResult.passed) {
      return NextResponse.json(
        {
          success: false,
          error: "Letter failed bias detection",
          warnings: letterResult.biasWarnings,
          letter: letterResult.letter,
          confidenceScore: 0,
        },
        { status: 400 }
      );
    }

    // Step 3: Create decision record
    const decision = await db.decision.create({
      data: {
        jobId: data.jobId,
        candidateId: data.candidateId,
        authorId: user.id,
        outcome: "REJECTED",
        reasons,
        generatedLetter: letterResult.letter,
        biasCheckPassed: letterResult.passed,
      },
    });

    // Step 4: Optionally send the email
    let sentAt = null;
    let messageId = null;

    if (data.sendImmediately) {
      const scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : undefined;

      const emailResult = await sendRejectionLetter({
        candidateEmail: candidate.email,
        candidateName: candidate.name || "Candidate",
        jobTitle: job.title,
        companyName: user.company.name,
        letter: letterResult.letter,
        scheduledFor,
      });

      if (emailResult.success) {
        sentAt = scheduledFor || new Date();
        messageId = emailResult.messageId;

        // Update decision
        await db.decision.update({
          where: { id: decision.id },
          data: { sentAt },
        });
      }
    }

    // Step 5: Calculate confidence score
    const confidenceScore = calculateConfidenceScore({
      biasCheckPassed: letterResult.passed,
      hasInterviewNotes: notes.length > 0,
      reasonsCount: reasons.length,
      biasWarningsCount: letterResult.biasWarnings.length,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: data.sendImmediately ? "letter.one_click_sent" : "letter.one_click_generated",
        entityType: "Decision",
        entityId: decision.id,
        metadata: {
          candidateEmail: candidate.email,
          jobTitle: job.title,
          confidenceScore,
          biasCheckPassed: letterResult.passed,
          sent: data.sendImmediately,
        },
      },
    });

    return NextResponse.json({
      success: true,
      decisionId: decision.id,
      letter: letterResult.letter,
      confidenceScore,
      biasCheckPassed: letterResult.passed,
      biasWarnings: letterResult.biasWarnings,
      reasons,
      sent: data.sendImmediately,
      sentAt,
      messageId,
      message: data.sendImmediately
        ? "✅ Letter generated and sent successfully!"
        : "✅ Letter generated successfully! Review and send when ready.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("One-click error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function calculateConfidenceScore(params: {
  biasCheckPassed: boolean;
  hasInterviewNotes: boolean;
  reasonsCount: number;
  biasWarningsCount: number;
}): number {
  let score = 0;

  // Bias check (40 points)
  if (params.biasCheckPassed) score += 40;

  // Interview notes (30 points)
  if (params.hasInterviewNotes) score += 30;

  // Quality of feedback (20 points)
  if (params.reasonsCount >= 3) {
    score += 20;
  } else if (params.reasonsCount >= 2) {
    score += 15;
  } else if (params.reasonsCount >= 1) {
    score += 10;
  }

  // No bias warnings (10 points)
  if (params.biasWarningsCount === 0) score += 10;

  return score;
}
