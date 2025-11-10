import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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

    const where: any = {
      job: { companyId: user.companyId },
    };

    if (jobId) {
      where.jobId = jobId;
    }

    const candidates = await db.candidate.findMany({
      where,
      include: {
        job: {
          select: {
            title: true,
          },
        },
        decisions: {
          select: {
            outcome: true,
            sentAt: true,
            createdAt: true,
          },
        },
      },
    });

    const csvData = candidates.map((candidate) => ({
      name: candidate.name || "",
      email: candidate.email,
      job: candidate.job.title,
      jobId: candidate.jobId,
      appliedAt: candidate.createdAt.toISOString(),
      status: candidate.decisions[0]?.outcome || "PENDING",
      decisionDate: candidate.decisions[0]?.createdAt.toISOString() || "",
      letterSent: candidate.decisions[0]?.sentAt ? "Yes" : "No",
    }));

    // Log audit
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "data.exported",
        entityType: "Candidate",
        entityId: "batch",
        metadata: {
          count: candidates.length,
          jobId,
        },
      },
    });

    return NextResponse.json(csvData);
  } catch (error) {
    console.error("Error exporting candidates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
