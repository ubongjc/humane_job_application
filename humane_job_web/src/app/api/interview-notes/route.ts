import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateNoteSchema = z.object({
  jobId: z.string(),
  candidateEmail: z.string().email(),
  structuredScores: z.record(z.number()),
  summary: z.string().optional(),
});

/**
 * POST /api/interview-notes
 * Create interview feedback with structured rubric scores
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = CreateNoteSchema.parse(body);

    // Verify job belongs to company
    const job = await db.job.findFirst({
      where: {
        id: data.jobId,
        companyId: user.companyId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Create interview note
    const note = await db.interviewNote.create({
      data: {
        jobId: data.jobId,
        candidateEmail: data.candidateEmail,
        authorId: user.id,
        structuredScores: data.structuredScores,
        summary: data.summary,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "interview_note.created",
        entityType: "InterviewNote",
        entityId: note.id,
        metadata: {
          candidateEmail: data.candidateEmail,
          jobTitle: job.title,
        },
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating interview note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/interview-notes
 * Get interview notes for a job or candidate
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    const candidateEmail = searchParams.get("candidateEmail");

    const where: any = {
      job: { companyId: user.companyId },
    };

    if (jobId) where.jobId = jobId;
    if (candidateEmail) where.candidateEmail = candidateEmail;

    const notes = await db.interviewNote.findMany({
      where,
      include: {
        author: {
          select: {
            name: true,
            email: true,
          },
        },
        job: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Error fetching interview notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
