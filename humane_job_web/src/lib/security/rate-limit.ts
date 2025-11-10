import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  interval: number; // in milliseconds
  uniqueTokenPerInterval: number;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

export class RateLimiter {
  private interval: number;
  private uniqueTokenPerInterval: number;

  constructor(config: RateLimitConfig) {
    this.interval = config.interval;
    this.uniqueTokenPerInterval = config.uniqueTokenPerInterval;
  }

  async check(identifier: string, limit: number): Promise<{
    success: boolean;
    remaining: number;
    reset: number;
  }> {
    const now = Date.now();
    const key = `${identifier}`;

    // Initialize or reset if expired
    if (!rateLimitStore[key] || rateLimitStore[key].resetTime <= now) {
      rateLimitStore[key] = {
        count: 0,
        resetTime: now + this.interval,
      };
    }

    const record = rateLimitStore[key];

    // Increment count
    record.count++;

    const success = record.count <= limit;
    const remaining = Math.max(0, limit - record.count);

    return {
      success,
      remaining,
      reset: record.resetTime,
    };
  }

  // Cleanup old entries periodically
  cleanup() {
    const now = Date.now();
    Object.keys(rateLimitStore).forEach((key) => {
      if (rateLimitStore[key].resetTime <= now) {
        delete rateLimitStore[key];
      }
    });
  }
}

// Default rate limiters
export const apiRateLimiter = new RateLimiter({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export const authRateLimiter = new RateLimiter({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 100,
});

export const strictRateLimiter = new RateLimiter({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
});

// Middleware wrapper
export async function withRateLimit(
  req: NextRequest,
  limiter: RateLimiter = apiRateLimiter,
  limit: number = 60
): Promise<NextResponse | null> {
  // Get identifier (IP or user ID)
  const identifier =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.ip ||
    "unknown";

  const result = await limiter.check(identifier, limit);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": new Date(result.reset).toISOString(),
          "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null; // Continue
}

// Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    apiRateLimiter.cleanup();
    authRateLimiter.cleanup();
    strictRateLimiter.cleanup();
  }, 5 * 60 * 1000);
}
