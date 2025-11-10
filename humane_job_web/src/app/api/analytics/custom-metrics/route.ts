import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/analytics/custom-metrics
 * 📊 Receive and store custom performance metrics
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, duration, url, timestamp } = body;

    // Store in database
    await db.auditLog.create({
      data: {
        companyId: null, // System-wide metric
        userId: null,
        action: "performance.custom_metric",
        entityType: "CustomMetric",
        entityId: `${name}-${timestamp}`,
        metadata: {
          name,
          duration,
          url,
          timestamp,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record custom metric:", error);
    return NextResponse.json({ success: true });
  }
}

/**
 * GET /api/analytics/custom-metrics
 * 📊 Get aggregated custom metrics for dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const hours = parseInt(searchParams.get("hours") || "24");

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get custom metrics from audit log
    const metrics = await db.auditLog.findMany({
      where: {
        action: "performance.custom_metric",
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1000,
    });

    // Aggregate by metric name
    const aggregated: Record<
      string,
      {
        count: number;
        avg: number;
        min: number;
        max: number;
        p50: number;
        p95: number;
        p99: number;
      }
    > = {};

    metrics.forEach((log) => {
      const metadata = log.metadata as any;
      const name = metadata.name;
      const duration = metadata.duration;

      if (!aggregated[name]) {
        aggregated[name] = {
          count: 0,
          avg: 0,
          min: Infinity,
          max: -Infinity,
          p50: 0,
          p95: 0,
          p99: 0,
        };
      }

      aggregated[name].count++;
      aggregated[name].avg += duration;
      aggregated[name].min = Math.min(aggregated[name].min, duration);
      aggregated[name].max = Math.max(aggregated[name].max, duration);
    });

    // Calculate averages and percentiles
    Object.keys(aggregated).forEach((name) => {
      const metric = aggregated[name];
      metric.avg = metric.avg / metric.count;

      // Get durations for percentile calculation
      const durations = metrics
        .filter((log) => (log.metadata as any).name === name)
        .map((log) => (log.metadata as any).duration)
        .sort((a, b) => a - b);

      metric.p50 = durations[Math.floor(durations.length * 0.5)] || 0;
      metric.p95 = durations[Math.floor(durations.length * 0.95)] || 0;
      metric.p99 = durations[Math.floor(durations.length * 0.99)] || 0;
    });

    return NextResponse.json({ metrics: aggregated });
  } catch (error) {
    console.error("Failed to get custom metrics:", error);
    return NextResponse.json(
      { error: "Failed to get metrics" },
      { status: 500 }
    );
  }
}
