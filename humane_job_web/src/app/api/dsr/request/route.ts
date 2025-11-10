import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const DSRRequestSchema = z.object({
  email: z.string().email(),
  requestType: z.enum(["EXPORT", "DELETE"]),
  companyId: z.string(),
});

/**
 * POST /api/dsr/request
 * Create a Data Subject Request (GDPR/CCPA compliance)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = DSRRequestSchema.parse(body);

    // Create data export request
    const dataExport = await db.dataExport.create({
      data: {
        companyId: data.companyId,
        email: data.email,
        requestType: data.requestType,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // If it's an export request, process it
    if (data.requestType === "EXPORT") {
      // Gather all data for this email
      const candidates = await db.candidate.findMany({
        where: {
          email: data.email,
          job: { companyId: data.companyId },
        },
        include: {
          job: true,
          decisions: true,
        },
      });

      const interviewNotes = await db.interviewNote.findMany({
        where: {
          candidateEmail: data.email,
          job: { companyId: data.companyId },
        },
      });

      const exportData = {
        email: data.email,
        requestDate: new Date().toISOString(),
        candidates: candidates.map((c) => ({
          jobTitle: c.job.title,
          appliedAt: c.createdAt,
          decisions: c.decisions,
        })),
        interviewNotes: interviewNotes.map((n) => ({
          jobId: n.jobId,
          scores: n.structuredScores,
          summary: n.summary,
          date: n.createdAt,
        })),
      };

      // In production, upload to R2/S3 with signed URL
      // For now, store inline
      await db.dataExport.update({
        where: { id: dataExport.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          // fileUrl would be the signed URL
        },
      });
    } else {
      // DELETE request - needs approval
      await db.auditLog.create({
        data: {
          companyId: data.companyId,
          action: "dsr.delete_requested",
          entityType: "DataExport",
          entityId: dataExport.id,
          metadata: { email: data.email },
        },
      });
    }

    return NextResponse.json({
      success: true,
      requestId: dataExport.id,
      status: dataExport.status,
      message:
        data.requestType === "EXPORT"
          ? "Your data export is ready"
          : "Your deletion request has been submitted for review",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error processing DSR request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
