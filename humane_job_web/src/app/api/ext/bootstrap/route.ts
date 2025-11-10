import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BootstrapSchema = z.object({
  extensionVersion: z.string(),
  browser: z.string(),
  scopes: z.array(z.string()),
});

/**
 * POST /api/ext/bootstrap
 * Extension authentication and scope verification
 * Returns company settings and allowed domains for the extension
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { extensionVersion, browser, scopes } = BootstrapSchema.parse(body);

    // Get user with company info
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            domain: true,
            tier: true,
            settings: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if extension API is enabled
    if (!process.env.ENABLE_EXTENSION_API) {
      return NextResponse.json(
        { error: "Extension API is disabled" },
        { status: 403 }
      );
    }

    // Validate requested scopes against user's role
    const allowedScopes = getRoleScopePermissions(user.role);
    const deniedScopes = scopes.filter((s) => !allowedScopes.includes(s));

    if (deniedScopes.length > 0) {
      return NextResponse.json(
        { error: "Insufficient permissions for requested scopes", deniedScopes },
        { status: 403 }
      );
    }

    // Log extension bootstrap
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: userId,
        action: "extension.bootstrap",
        entityType: "Extension",
        entityId: userId,
        metadata: {
          extensionVersion,
          browser,
          scopes,
        },
      },
    });

    // Return configuration
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      company: user.company,
      scopes: allowedScopes,
      config: {
        allowedDomains: getAllowedDomains(user.company.settings),
        features: getFeatureFlags(user.company.tier),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error in extension bootstrap:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getRoleScopePermissions(role: string): string[] {
  const baseScopes = ["read:jobs", "read:candidates"];

  switch (role) {
    case "ADMIN":
      return [...baseScopes, "write:jobs", "write:decisions", "write:notes", "admin:all"];
    case "HIRING_MANAGER":
      return [...baseScopes, "write:jobs", "write:decisions", "write:notes"];
    case "RECRUITER":
      return [...baseScopes, "write:candidates", "write:notes"];
    case "INTERVIEWER":
      return [...baseScopes, "write:notes"];
    default:
      return baseScopes;
  }
}

function getAllowedDomains(settings: any): string[] {
  // Extract allowed ATS domains from company settings
  const defaultDomains = [
    "greenhouse.io",
    "lever.co",
    "workday.com",
    "jazz.co",
    "breezy.hr",
  ];

  if (settings && Array.isArray(settings.allowedDomains)) {
    return [...defaultDomains, ...settings.allowedDomains];
  }

  return defaultDomains;
}

function getFeatureFlags(tier: string): Record<string, boolean> {
  return {
    customTemplates: tier === "PROFESSIONAL" || tier === "ENTERPRISE",
    auditExport: tier === "ENTERPRISE",
    biasGuardrails: true, // Always enabled
    clientEncryption: tier === "PROFESSIONAL" || tier === "ENTERPRISE",
  };
}
