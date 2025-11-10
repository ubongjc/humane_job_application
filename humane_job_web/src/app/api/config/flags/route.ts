import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

// ========================================
// Feature Flag Schema
// ========================================

const UpdateFlagSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.union([
    z.boolean(),
    z.string(),
    z.number(),
    z.object({}).passthrough(),
  ]),
});

// ========================================
// Default Feature Flags (System-wide)
// ========================================

const DEFAULT_FLAGS: Record<string, any> = {
  // Core features
  explainable_cards: true,
  appeals_enabled: true,
  bulk_operations: true,

  // AI features
  ai_copilot: true,
  bias_detection: true,
  template_linting: true,

  // Compliance
  audit_logging: true,
  encryption_at_rest: true,

  // UX features
  auto_save: true,
  keyboard_shortcuts: true,
  command_palette: true,

  // Advanced
  smart_scheduling: false, // Beta
  candidate_portal: false, // Beta
  webhook_integrations: true,

  // Limits
  max_bulk_size: 500,
  appeal_window_days: 30,
  appeal_sla_days: 7,

  // Locales
  supported_locales: ["en-US", "en-EU", "en-CA", "es-ES", "fr-FR", "de-DE"],
  supported_tones: ["formal", "friendly", "empathetic"],
};

// ========================================
// GET /api/config/flags
// Get feature flags for company
// ========================================

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { company: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get company-specific flags
    const companyFlags = await db.featureFlag.findMany({
      where: { companyId: user.companyId },
    });

    // Merge with defaults (company flags override defaults)
    const flags: Record<string, any> = { ...DEFAULT_FLAGS };

    companyFlags.forEach((flag) => {
      flags[flag.key] = flag.value;
    });

    // Add tier-based restrictions
    const tier = user.company.tier;
    if (tier === "FREE") {
      flags.max_bulk_size = 50;
      flags.appeals_enabled = false;
      flags.webhook_integrations = false;
      flags.smart_scheduling = false;
    } else if (tier === "STARTER") {
      flags.max_bulk_size = 100;
      flags.appeals_enabled = false;
      flags.webhook_integrations = false;
    } else if (tier === "PROFESSIONAL") {
      flags.max_bulk_size = 250;
    }
    // ENTERPRISE: No restrictions

    return NextResponse.json({
      success: true,
      flags,
      tier,
    });
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ========================================
// PUT /api/config/flags
// Update feature flag (RBAC: admin only)
// ========================================

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = UpdateFlagSchema.parse(body);

    // Get user and verify admin
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin required." },
        { status: 403 }
      );
    }

    // Upsert flag
    const flag = await db.featureFlag.upsert({
      where: {
        companyId_key: {
          companyId: user.companyId,
          key: data.key,
        },
      },
      create: {
        companyId: user.companyId,
        key: data.key,
        value: data.value,
      },
      update: {
        value: data.value,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "feature_flag.updated",
        entityType: "FeatureFlag",
        entityId: flag.id,
        metadata: {
          key: data.key,
          value: data.value,
        },
      },
    });

    Sentry.addBreadcrumb({
      category: "feature_flag",
      message: "Feature flag updated",
      level: "info",
      data: { key: data.key, value: data.value },
    });

    return NextResponse.json({
      success: true,
      flag,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating feature flag:", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ========================================
// Helper: Check if feature is enabled
// ========================================

export async function checkFeatureFlag(
  companyId: string,
  key: string
): Promise<boolean> {
  // Check company-specific flag
  const flag = await db.featureFlag.findUnique({
    where: {
      companyId_key: {
        companyId,
        key,
      },
    },
  });

  if (flag) {
    return !!flag.value;
  }

  // Fall back to default
  return !!DEFAULT_FLAGS[key];
}
