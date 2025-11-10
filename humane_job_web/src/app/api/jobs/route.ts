import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateJobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  rubric: z.record(z.any()).optional(),
  jurisdiction: z.enum(["US", "EU", "CA"]).default("US"),
});

// GET /api/jobs - List jobs
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { companyId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = {
      companyId: user.companyId,
      ...(status && { status: status as any }),
    };

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      db.job.count({ where }),
    ]);

    return NextResponse.json({ jobs, total });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/jobs - Create job
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { companyId: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check permissions - only ADMIN and HIRING_MANAGER can create jobs
    if (!["ADMIN", "HIRING_MANAGER"].includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validatedData = CreateJobSchema.parse(body);

    const job = await db.job.create({
      data: {
        ...validatedData,
        companyId: user.companyId,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: userId,
        action: "job.created",
        entityType: "Job",
        entityId: job.id,
        metadata: { title: job.title },
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
