import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { llmProvider } from "@/lib/llm/provider";
import { checkBias } from "@/lib/ethics/bias_rules";
import {
  generateExplainableCard,
  createExplainableReceipt,
  type CandidateScore,
  type RubricCriterion,
} from "@/lib/letters/explainable";
import { hashDecision } from "@/lib/policy/hash";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const GenerateLetterSchema = z.object({
  candidateId: z.string(),
  jobId: z.string(),
  outcome: z.enum(["REJECTED", "WAITLIST"]),
  reasons: z.array(z.string()).optional(),
  tone: z.enum(["formal", "friendly", "empathetic"]).default("empathetic"),
  useCustomTemplate: z.boolean().default(false),
  templateId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

/**
 * POST /api/letter/generate-v2
 *
 * Generate a rejection letter using AI with Explainable Feedback Card (XFC).
 *
 * This endpoint:
 * 1. Validates permissions and fetches data
 * 2. Aggregates interview notes into rubric scores
 * 3. Generates letter using LLM with fallback
 * 4. Runs comprehensive bias detection
 * 5. Creates Explainable Feedback Card
 * 6. Generates cryptographic receipt
 * 7. Stores decision with audit trail
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

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
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    // Get interview notes for XFC generation
    const notes = await db.interviewNote.findMany({
      where: {
        jobId: data.jobId,
        candidateEmail: candidate.email,
      },
      include: {
        author: { select: { name: true } },
      },
    });

    // Parse rubric from job
    const rubric = (job.rubric as any) || {
      criteria: [
        { name: "Technical Skills", weight: 0.4 },
        { name: "Communication", weight: 0.3 },
        { name: "Culture Alignment", weight: 0.3 },
      ],
    };

    const rubricCriteria: RubricCriterion[] = rubric.criteria || [];

    // Aggregate interview scores
    const candidateScores: CandidateScore[] = [];

    if (notes.length > 0) {
      const scoresByCreiterion: Record<string, { total: number; count: number; evidences: string[] }> =
        {};

      notes.forEach((note) => {
        const scores = note.structuredScores as Record<string, number>;
        const summary = note.summary || "";

        Object.entries(scores).forEach(([criterion, score]) => {
          if (!scoresByCreiterion[criterion]) {
            scoresByCreiterion[criterion] = {
              total: 0,
              count: 0,
              evidences: [],
            };
          }

          scoresByCreiterion[criterion].total += score;
          scoresByCreiterion[criterion].count += 1;

          if (summary) {
            scoresByCreiterion[criterion].evidences.push(
              `${note.author.name}: ${summary.substring(0, 100)}`
            );
          }
        });
      });

      // Calculate averages
      Object.entries(scoresByCreiterion).forEach(([criterion, data]) => {
        const avgScore = data.total / data.count;
        const criterionDef = rubricCriteria.find((c) => c.name === criterion);

        candidateScores.push({
          criterion,
          score: avgScore,
          weight: criterionDef?.weight || 0.33,
          evidence: data.evidences[0], // Use first evidence
        });
      });
    }

    // Generate reasons from scores if not provided
    let reasons = data.reasons || [];
    if (reasons.length === 0 && candidateScores.length > 0) {
      const belowThreshold = candidateScores.filter((s) => s.score < 3.5);
      reasons = belowThreshold
        .slice(0, 3)
        .map(
          (s) =>
            `${s.criterion}: Scored ${s.score.toFixed(1)}/5.0 (below 3.5 threshold)`
        );
    }

    if (reasons.length === 0) {
      reasons = [
        "Other candidates demonstrated stronger alignment with our specific requirements",
      ];
    }

    // Build letter generation prompt
    const systemPrompt = `You are a professional HR assistant generating respectful, empathetic rejection letters.

RULES:
1. Be respectful, empathetic, and constructive
2. NEVER mention protected characteristics (age, gender, race, disability, religion, etc.)
3. NEVER speculate about personal attributes
4. Focus ONLY on job-related qualifications
5. Keep it concise (200-300 words)
6. Use professional, warm tone
7. Wish them well in their job search

Jurisdiction: ${job.jurisdiction}
Tone: ${data.tone}`;

    const userPrompt = `Generate a rejection letter for:

Candidate: ${candidate.name || "Candidate"}
Position: ${job.title}
Company: ${user.company.name}

Reasons (job-related only):
${reasons.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Generate a respectful rejection letter following the rules above.`;

    // Generate letter using LLM with fallback
    const llmResponse = await llmProvider.generate({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      config: {
        temperature: 0.7,
        maxTokens: 800,
      },
      idempotencyKey: data.idempotencyKey,
      bannedPhrases: [
        "culture fit",
        "not a good fit",
        "doesn't match our culture",
      ],
    });

    const generatedLetter = llmResponse.content;

    // Run bias detection
    const biasResult = checkBias(generatedLetter, job.jurisdiction);

    if (!biasResult.passed) {
      Sentry.captureMessage("Generated letter failed bias check", {
        level: "warning",
        tags: { source: "letter_generation" },
        extra: {
          warnings: biasResult.warnings,
          score: biasResult.score,
        },
      });

      return NextResponse.json(
        {
          error: "Generated letter failed bias detection",
          warnings: biasResult.warnings,
          score: biasResult.score,
          letter: generatedLetter,
        },
        { status: 400 }
      );
    }

    // Generate Explainable Feedback Card
    const explainableCard = generateExplainableCard({
      decisionId: "pending", // Will be set after decision creation
      candidateEmail: candidate.email,
      jobTitle: job.title,
      rubric: rubricCriteria,
      candidateScores,
      passingThreshold: 3.5,
      locale: job.jurisdiction === "EU" ? "en-EU" : "en-US",
    });

    // Get template version
    const templateVersion = data.templateId || "default-v1.0";

    // Create decision record
    const decision = await db.decision.create({
      data: {
        jobId: data.jobId,
        candidateId: data.candidateId,
        authorId: user.id,
        outcome: data.outcome,
        reasons: reasons,
        generatedLetter,
        biasCheckPassed: biasResult.passed,
        letterTemplate: data.templateId,
        templateVersion,
        idempotencyKey: data.idempotencyKey,
      },
    });

    // Update XFC with decision ID
    explainableCard.decisionId = decision.id;

    // Create cryptographic receipt
    const receipt = createExplainableReceipt(explainableCard, {
      letter: generatedLetter,
      reasons,
      templateVersion,
    });

    // Store receipt
    await db.explainableReceipt.create({
      data: {
        decisionId: decision.id,
        hash: receipt.hash,
        explainable: explainableCard as any,
        version: explainableCard.version,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "letter.generated_v2",
        entityType: "Decision",
        entityId: decision.id,
        metadata: {
          candidateEmail: candidate.email,
          jobTitle: job.title,
          tone: data.tone,
          biasScore: biasResult.score,
          biasWarnings: biasResult.warnings,
          llmProvider: llmResponse.provider,
          llmModel: llmResponse.model,
          hasExplainableCard: true,
          receiptHash: receipt.hash,
        },
      },
    });

    const duration = Date.now() - startTime;

    Sentry.addBreadcrumb({
      category: "letter_generation",
      message: "Letter generated with XFC",
      level: "info",
      data: {
        decisionId: decision.id,
        duration,
        biasScore: biasResult.score,
        provider: llmResponse.provider,
      },
    });

    return NextResponse.json({
      success: true,
      decisionId: decision.id,
      letter: generatedLetter,
      biasCheckPassed: biasResult.passed,
      biasWarnings: biasResult.warnings,
      biasScore: biasResult.score,
      explainable: explainableCard,
      receipt: {
        hash: receipt.hash,
        signature: receipt.signature,
      },
      provider: llmResponse.provider,
      duration,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error generating letter:", error);
    Sentry.captureException(error, {
      tags: { source: "letter_generation_v2" },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
