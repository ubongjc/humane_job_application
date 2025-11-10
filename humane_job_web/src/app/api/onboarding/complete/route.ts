import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const OnboardingSchema = z.object({
  companyName: z.string().min(1),
  companyDomain: z.string().min(1),
  tier: z.enum(["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]).default("FREE"),
  role: z.enum(["ADMIN", "HIRING_MANAGER", "RECRUITER", "INTERVIEWER"]).default("ADMIN"),
});

/**
 * POST /api/onboarding/complete
 * Complete user onboarding - create company and user records
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already onboarded" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = OnboardingSchema.parse(body);

    // Get user info from Clerk
    const { sessionClaims } = await auth();
    const email = sessionClaims?.email as string;
    const name = sessionClaims?.name as string;

    if (!email) {
      return NextResponse.json(
        { error: "Email not found in session" },
        { status: 400 }
      );
    }

    // Create company
    const company = await db.company.create({
      data: {
        name: data.companyName,
        domain: data.companyDomain,
        tier: data.tier,
      },
    });

    // Create user
    const user = await db.user.create({
      data: {
        clerkId: userId,
        companyId: company.id,
        email,
        name,
        role: data.role,
      },
    });

    // Create initial subscription
    await db.subscription.create({
      data: {
        companyId: company.id,
        status: "TRIAL",
        tier: data.tier,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      },
    });

    // Create default templates
    await createDefaultTemplates(company.id);

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: company.id,
        userId: user.id,
        action: "onboarding.completed",
        entityType: "Company",
        entityId: company.id,
        metadata: {
          tier: data.tier,
          role: data.role,
        },
      },
    });

    return NextResponse.json({
      success: true,
      company,
      user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error in onboarding:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function createDefaultTemplates(companyId: string) {
  const templates = [
    {
      companyId,
      name: "US Standard Rejection",
      jurisdiction: "US",
      template: `Dear {{candidateName}},

Thank you for taking the time to apply for the {{jobTitle}} position at {{companyName}} and for speaking with our team.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.

{{feedback}}

We appreciate your interest in {{companyName}} and wish you the best in your job search.

Best regards,
{{companyName}} Hiring Team`,
      variables: {
        candidateName: "Candidate's name",
        jobTitle: "Job title",
        companyName: "Company name",
        feedback: "Constructive feedback points",
      },
      isDefault: true,
    },
    {
      companyId,
      name: "EU GDPR-Compliant Rejection",
      jurisdiction: "EU",
      template: `Dear {{candidateName}},

Thank you for your application for the {{jobTitle}} position at {{companyName}}.

Following our evaluation process, we have decided not to proceed with your application at this time. This decision was based on the following criteria:

{{feedback}}

As per GDPR regulations, your application data will be retained for [retention period] and then securely deleted. You have the right to request access to or deletion of your data at any time by contacting our data protection officer.

We wish you success in your career search.

Kind regards,
{{companyName}} Recruitment Team`,
      jurisdiction: "EU",
      variables: {
        candidateName: "Candidate's name",
        jobTitle: "Job title",
        companyName: "Company name",
        feedback: "Specific evaluation feedback",
      },
      isDefault: true,
    },
    {
      companyId,
      name: "Canada Friendly Rejection",
      jurisdiction: "CA",
      template: `Dear {{candidateName}},

Thank you for your interest in the {{jobTitle}} position at {{companyName}} and for the time you invested in the application process.

After thoughtful consideration, we have chosen to pursue other candidates for this role.

{{feedback}}

We encourage you to apply for future opportunities that align with your skills and experience.

Best wishes,
{{companyName}} Hiring Team`,
      jurisdiction: "CA",
      variables: {
        candidateName: "Candidate's name",
        jobTitle: "Job title",
        companyName: "Company name",
        feedback: "Constructive feedback",
      },
      isDefault: true,
    },
  ];

  await db.letterTemplate.createMany({
    data: templates,
  });
}
