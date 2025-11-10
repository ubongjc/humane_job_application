import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/analytics/web-vitals
 * 📊 Receive and store Web Vitals metrics
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      name,
      value,
      rating,
      id,
      delta,
      navigationType,
      url,
      userAgent,
      connection,
      timestamp,
    } = body;

    // Store in database for analysis
    // In production, consider using a time-series database like TimescaleDB
    await db.auditLog.create({
      data: {
        companyId: null, // System-wide metric
        userId: null,
        action: "performance.web_vitals",
        entityType: "WebVitals",
        entityId: id,
        metadata: {
          metric: name,
          value,
          rating,
          delta,
          navigationType,
          url,
          userAgent,
          connection,
          timestamp,
        },
      },
    });

    // Also send to external analytics (optional)
    if (process.env.ANALYTICS_API_KEY) {
      await sendToExternalAnalytics(body);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record Web Vitals:", error);
    // Return success anyway to not break client
    return NextResponse.json({ success: true });
  }
}

async function sendToExternalAnalytics(data: any) {
  // Send to Google Analytics, Mixpanel, etc.
  // Example for Google Analytics 4:
  if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
    try {
      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`,
        {
          method: "POST",
          body: JSON.stringify({
            client_id: data.id,
            events: [
              {
                name: "web_vitals",
                params: {
                  metric_name: data.name,
                  metric_value: data.value,
                  metric_rating: data.rating,
                },
              },
            ],
          }),
        }
      );
    } catch (error) {
      console.error("Failed to send to GA:", error);
    }
  }
}
