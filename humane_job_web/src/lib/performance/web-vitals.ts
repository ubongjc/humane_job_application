/**
 * 📊 WEB VITALS TRACKING
 *
 * Monitor real-world performance metrics to ensure the app stays FAST.
 *
 * Tracks Core Web Vitals:
 * - LCP (Largest Contentful Paint) - Loading performance
 * - FID (First Input Delay) - Interactivity
 * - CLS (Cumulative Layout Shift) - Visual stability
 * - FCP (First Contentful Paint) - Initial load
 * - TTFB (Time to First Byte) - Server response
 *
 * Targets (Google's "Good" thresholds):
 * - LCP: < 2.5s
 * - FID: < 100ms
 * - CLS: < 0.1
 * - FCP: < 1.8s
 * - TTFB: < 800ms
 */

import { onCLS, onFCP, onFID, onLCP, onTTFB, Metric } from "web-vitals";

/**
 * Performance thresholds
 */
const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
} as const;

type MetricName = keyof typeof THRESHOLDS;
type MetricRating = "good" | "needs-improvement" | "poor";

interface EnhancedMetric extends Metric {
  rating: MetricRating;
}

/**
 * Rate a metric based on thresholds
 */
function getRating(name: MetricName, value: number): MetricRating {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return "good";
  if (value <= threshold.needsImprovement) return "needs-improvement";
  return "poor";
}

/**
 * Send metric to analytics
 */
async function sendToAnalytics(metric: EnhancedMetric) {
  // Send to our analytics endpoint
  try {
    await fetch("/api/analytics/web-vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        delta: metric.delta,
        navigationType: metric.navigationType,
        // Additional context
        url: window.location.pathname,
        userAgent: navigator.userAgent,
        connection: (navigator as any).connection?.effectiveType,
        timestamp: Date.now(),
      }),
    });
  } catch (error) {
    // Fail silently - don't break user experience
    console.warn("Failed to send Web Vitals:", error);
  }

  // Also log to console in development
  if (process.env.NODE_ENV === "development") {
    const emoji =
      metric.rating === "good" ? "✅" : metric.rating === "needs-improvement" ? "⚠️" : "❌";
    console.log(
      `${emoji} ${metric.name}: ${metric.value.toFixed(2)}${
        metric.name === "CLS" ? "" : "ms"
      } (${metric.rating})`
    );
  }
}

/**
 * Initialize Web Vitals tracking
 */
export function initWebVitals() {
  // Largest Contentful Paint
  onLCP((metric) => {
    sendToAnalytics({
      ...metric,
      rating: getRating("LCP", metric.value),
    });
  });

  // First Input Delay
  onFID((metric) => {
    sendToAnalytics({
      ...metric,
      rating: getRating("FID", metric.value),
    });
  });

  // Cumulative Layout Shift
  onCLS((metric) => {
    sendToAnalytics({
      ...metric,
      rating: getRating("CLS", metric.value),
    });
  });

  // First Contentful Paint
  onFCP((metric) => {
    sendToAnalytics({
      ...metric,
      rating: getRating("FCP", metric.value),
    });
  });

  // Time to First Byte
  onTTFB((metric) => {
    sendToAnalytics({
      ...metric,
      rating: getRating("TTFB", metric.value),
    });
  });
}

/**
 * 🎯 CUSTOM PERFORMANCE MARKERS
 *
 * Track custom performance metrics for our specific workflows.
 */

class PerformanceTracker {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number> = new Map();

  /**
   * Start tracking a custom metric
   */
  start(name: string) {
    this.marks.set(name, performance.now());
  }

  /**
   * End tracking and record duration
   */
  end(name: string): number | null {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`No start mark found for: ${name}`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.measures.set(name, duration);
    this.marks.delete(name);

    // Log in development
    if (process.env.NODE_ENV === "development") {
      console.log(`⏱️  ${name}: ${duration.toFixed(2)}ms`);
    }

    // Send to analytics
    this.sendCustomMetric(name, duration);

    return duration;
  }

  /**
   * Measure a function execution time
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  /**
   * Get all recorded measures
   */
  getMeasures(): Record<string, number> {
    return Object.fromEntries(this.measures);
  }

  /**
   * Send custom metric to analytics
   */
  private async sendCustomMetric(name: string, duration: number) {
    try {
      await fetch("/api/analytics/custom-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          duration,
          url: window.location.pathname,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      // Fail silently
      console.warn("Failed to send custom metric:", error);
    }
  }
}

// Global instance
export const performanceTracker = new PerformanceTracker();

/**
 * 🔍 PERFORMANCE MONITORING COMPONENT
 *
 * Display real-time performance stats (dev only)
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private stats: {
    apiCalls: number;
    avgResponseTime: number;
    cacheHits: number;
    cacheMisses: number;
  } = {
    apiCalls: 0,
    avgResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  private responseTimes: number[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordApiCall(responseTime: number) {
    this.stats.apiCalls++;
    this.responseTimes.push(responseTime);

    // Keep only last 100 calls
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    // Calculate average
    this.stats.avgResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  recordCacheHit() {
    this.stats.cacheHits++;
  }

  recordCacheMiss() {
    this.stats.cacheMisses++;
  }

  getStats() {
    return {
      ...this.stats,
      cacheHitRate:
        this.stats.cacheHits + this.stats.cacheMisses > 0
          ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100
          : 0,
    };
  }

  reset() {
    this.stats = {
      apiCalls: 0,
      avgResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.responseTimes = [];
  }
}

/**
 * 🎨 REACT HOOK FOR PERFORMANCE TRACKING
 *
 * Track component render performance
 */
export function usePerformanceTracking(componentName: string) {
  if (typeof window === "undefined") return;

  const startTime = performance.now();

  // Track render time on mount
  if (process.env.NODE_ENV === "development") {
    setTimeout(() => {
      const renderTime = performance.now() - startTime;
      if (renderTime > 16) {
        // Slower than 60fps
        console.warn(
          `🐌 Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`
        );
      }
    }, 0);
  }
}

/**
 * 📈 RESOURCE TIMING ANALYSIS
 *
 * Analyze network resource performance
 */
export function analyzeResourceTiming() {
  if (typeof window === "undefined" || !window.performance) return;

  const resources = performance.getEntriesByType("resource");

  const analysis = {
    total: resources.length,
    scripts: 0,
    stylesheets: 0,
    images: 0,
    fonts: 0,
    api: 0,
    slowResources: [] as Array<{ name: string; duration: number }>,
  };

  resources.forEach((resource: any) => {
    // Categorize
    if (resource.name.includes(".js")) analysis.scripts++;
    if (resource.name.includes(".css")) analysis.stylesheets++;
    if (resource.name.match(/\.(png|jpg|jpeg|gif|webp|svg)/)) analysis.images++;
    if (resource.name.match(/\.(woff|woff2|ttf|otf)/)) analysis.fonts++;
    if (resource.name.includes("/api/")) analysis.api++;

    // Find slow resources (> 1s)
    if (resource.duration > 1000) {
      analysis.slowResources.push({
        name: resource.name,
        duration: resource.duration,
      });
    }
  });

  if (process.env.NODE_ENV === "development") {
    console.table(analysis);
    if (analysis.slowResources.length > 0) {
      console.warn("🐌 Slow resources detected:", analysis.slowResources);
    }
  }

  return analysis;
}
