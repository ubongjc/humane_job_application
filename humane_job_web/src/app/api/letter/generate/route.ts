import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { generateRejectionLetter, generateFeedbackSuggestions } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

const GenerateLetterSchema = z.object({
  candidateId: z.string(),
  jobId: z.string(),
  outcome: z.enum(["REJECTED", "WAITLIST"]),
  reasons: z.array(z.string()).optional(),
  tone: z.enum(["formal", "friendly", "empathetic"]).default("empathetic"),
  useCustomTemplate: z.boolean().default(false),
  templateId: z.string().optional(),
});

/**
 * POST /api/letter/generate
 * Generate a rejection letter using AI
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = GenerateLetterSchema.parse(body);

    // Get user and verify permissions
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

    // Get job details
    const job = await db.job.findFirst({
      where: {
        id: data.jobId,
        companyId: user.companyId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get candidate
    const candidate = await db.candidate.findFirst({
      where: {
        id: data.candidateId,
        jobId: data.jobId,
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Get interview notes for feedback generation
    let reasons = data.reasons || [];
    if (reasons.length === 0) {
      const notes = await db.interviewNote.findMany({
        where: {
          jobId: data.jobId,
          candidateEmail: candidate.email,
        },
      });

      // Generate feedback suggestions from interview scores
      if (notes.length > 0 && job.rubric) {
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

        reasons = await generateFeedbackSuggestions(
          job.rubric as Record<string, any>,
          aggregatedScores
        );
      }
    }

    // Get custom template if requested
    let customTemplate: string | undefined;
    if (data.useCustomTemplate && data.templateId) {
      const template = await db.letterTemplate.findFirst({
        where: {
          id: data.templateId,
          OR: [
            { companyId: user.companyId },
            { companyId: null }, // System templates
          ],
          isActive: true,
        },
      });

      customTemplate = template?.template;
    }

    // Generate the letter
    const result = await generateRejectionLetter({
      candidateName: candidate.name || "Candidate",
      jobTitle: job.title,
      companyName: user.company.name,
      reasons,
      jurisdiction: job.jurisdiction as "US" | "EU" | "CA",
      tone: data.tone,
      customTemplate,
    });

    // Check if bias detection passed
    if (!result.passed) {
      return NextResponse.json(
        {
          error: "Letter failed bias detection",
          warnings: result.biasWarnings,
          letter: result.letter,
        },
        { status: 400 }
      );
    }

    // Create decision record
    const decision = await db.decision.create({
      data: {
        jobId: data.jobId,
        candidateId: data.candidateId,
        authorId: user.id,
        outcome: data.outcome,
        reasons: reasons,
        generatedLetter: result.letter,
        biasCheckPassed: result.passed,
        letterTemplate: data.templateId,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "letter.generated",
        entityType: "Decision",
        entityId: decision.id,
        metadata: {
          candidateEmail: candidate.email,
          jobTitle: job.title,
          tone: data.tone,
          biasWarnings: result.biasWarnings,
        },
      },
    });

    return NextResponse.json({
      success: true,
      decisionId: decision.id,
      letter: result.letter,
      biasWarnings: result.biasWarnings,
      biasCheckPassed: result.passed,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error generating letter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
