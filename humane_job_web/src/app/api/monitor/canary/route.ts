import { NextRequest, NextResponse } from "next/server";
import { llmProvider } from "@/lib/llm/provider";
import { checkBias } from "@/lib/ethics/bias_rules";
import { lintTemplate } from "@/lib/policy/template_linter";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

/**
 * GET /api/monitor/canary
 *
 * Synthetic monitoring endpoint that simulates letter generation
 * using a stub LLM provider (no real API calls, no PII).
 *
 * Checks:
 * - LLM provider health
 * - Bias detection functionality
 * - Template linting
 * - Response time
 *
 * This endpoint should be called by external monitoring (e.g., cron, uptime service)
 * to verify the system is operational.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Test LLM provider with stub model (no real API call)
    const llmResponse = await llmProvider.generate({
      messages: [
        {
          role: "system",
          content: "You are a test system. Respond with OK.",
        },
        {
          role: "user",
          content: "Health check",
        },
      ],
      config: {
        provider: "stub",
        model: "stub-1.0",
        maxTokens: 100,
        timeout: 5000,
      },
      idempotencyKey: `canary-${Date.now()}`,
    });

    if (!llmResponse.content) {
      throw new Error("LLM provider returned empty response");
    }

    // 2. Test bias detection
    const testLetter = `Dear John Doe,

Thank you for your interest in the Senior Developer position at Acme Corp.

After careful consideration of your qualifications and experience, we have decided to move forward with other candidates whose skills more closely match our specific requirements at this time.

We appreciate the time you invested in the interview process and wish you the best in your job search.

Best regards,
Acme Corp Hiring Team`;

    const biasResult = checkBias(testLetter, "US");

    if (biasResult.score < 80) {
      throw new Error(
        `Bias detection failed: score ${biasResult.score} (expected >= 80)`
      );
    }

    // 3. Test template linting
    const lintResult = lintTemplate(testLetter, {
      locale: "en-US",
      jurisdiction: "US",
      requiredPlaceholders: ["{{candidateName}}", "{{jobTitle}}", "{{companyName}}"],
    });

    // Template won't pass (missing placeholders), but linting should work
    if (lintResult.score === undefined) {
      throw new Error("Template linting failed: no score returned");
    }

    // 4. Calculate metrics
    const duration = Date.now() - startTime;
    const status = "healthy";

    // 5. Log to Sentry as canary event
    Sentry.addBreadcrumb({
      category: "canary",
      message: "Synthetic monitoring check",
      level: "info",
      data: {
        duration,
        llmProvider: llmResponse.provider,
        biasScore: biasResult.score,
        lintScore: lintResult.score,
        status,
      },
    });

    // 6. Return health status
    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      duration,
      checks: {
        llm: {
          status: "pass",
          provider: llmResponse.provider,
          model: llmResponse.model,
        },
        bias_detection: {
          status: "pass",
          score: biasResult.score,
        },
        template_linting: {
          status: "pass",
          score: lintResult.score,
        },
      },
      version: process.env.npm_package_version || "unknown",
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log error to Sentry
    Sentry.captureException(error, {
      tags: {
        source: "canary",
        critical: "true",
      },
      extra: {
        duration,
      },
    });

    console.error("Canary check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        duration,
        error: (error as Error).message,
        version: process.env.npm_package_version || "unknown",
      },
      { status: 503 } // Service Unavailable
    );
  }
}

/**
 * POST /api/monitor/canary
 *
 * Manual canary trigger with configurable parameters.
 * Useful for testing specific scenarios.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { testBias = true, testLint = true, testLLM = true } = body;

    const results: any = {
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Conditional checks
    if (testLLM) {
      const llmResponse = await llmProvider.generate({
        messages: [
          { role: "user", content: "Health check" },
        ],
        config: {
          provider: "stub",
          model: "stub-1.0",
          timeout: 5000,
        },
      });

      results.checks.llm = {
        status: llmResponse.content ? "pass" : "fail",
        provider: llmResponse.provider,
      };
    }

    if (testBias) {
      const biasResult = checkBias("Test letter content", "US");
      results.checks.bias_detection = {
        status: biasResult.score >= 80 ? "pass" : "fail",
        score: biasResult.score,
      };
    }

    if (testLint) {
      const lintResult = lintTemplate("Test template", {
        locale: "en-US",
        jurisdiction: "US",
      });
      results.checks.template_linting = {
        status: "pass",
        score: lintResult.score,
      };
    }

    results.duration = Date.now() - startTime;
    results.status = "healthy";

    return NextResponse.json(results);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: "canary_manual" },
    });

    return NextResponse.json(
      {
        status: "unhealthy",
        error: (error as Error).message,
        duration: Date.now() - startTime,
      },
      { status: 503 }
    );
  }
}
