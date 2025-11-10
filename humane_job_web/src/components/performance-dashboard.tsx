"use client";

/**
 * 📊 PERFORMANCE DASHBOARD
 *
 * Real-time performance monitoring for developers.
 * Shows Web Vitals, custom metrics, and resource timing.
 *
 * Usage:
 * - Add to development environments only
 * - Press Shift+Shift+P to toggle
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PerformanceMonitor } from "@/lib/performance/web-vitals";
import { Activity, X, RefreshCw } from "lucide-react";

export function PerformanceDashboard() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [customMetrics, setCustomMetrics] = useState<any>(null);

  // Keyboard shortcut: Shift+Shift+P (press Shift twice + P)
  useEffect(() => {
    let shiftPressCount = 0;
    let shiftTimer: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        shiftPressCount++;
        clearTimeout(shiftTimer);

        shiftTimer = setTimeout(() => {
          shiftPressCount = 0;
        }, 500);
      }

      if (e.key === "p" && shiftPressCount === 2) {
        setIsOpen((prev) => !prev);
        shiftPressCount = 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Refresh stats every 2 seconds
  useEffect(() => {
    if (!isOpen) return;

    const refresh = () => {
      const monitor = PerformanceMonitor.getInstance();
      setStats(monitor.getStats());
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Load custom metrics
  const loadCustomMetrics = async () => {
    try {
      const response = await fetch("/api/analytics/custom-metrics?hours=1");
      const data = await response.json();
      setCustomMetrics(data.metrics);
    } catch (error) {
      console.error("Failed to load metrics:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCustomMetrics();
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Open Performance Dashboard (Shift+Shift+P)"
      >
        <Activity className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-96 max-h-[600px] overflow-y-auto bg-gray-900 text-white rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-400" />
          <h3 className="font-semibold">Performance Monitor</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={loadCustomMetrics}
            className="text-white hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-gray-800 rounded p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-4">
        {/* Real-time Stats */}
        {stats && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-gray-300">
              Real-time Stats
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">API Calls</div>
                <div className="text-lg font-bold">{stats.apiCalls}</div>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Avg Response</div>
                <div className="text-lg font-bold">
                  {stats.avgResponseTime.toFixed(0)}ms
                </div>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Cache Hits</div>
                <div className="text-lg font-bold text-green-400">
                  {stats.cacheHits}
                </div>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <div className="text-gray-400">Cache Hit Rate</div>
                <div className="text-lg font-bold text-green-400">
                  {stats.cacheHitRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Metrics */}
        {customMetrics && Object.keys(customMetrics).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-gray-300">
              Custom Metrics (Last Hour)
            </h4>
            <div className="space-y-2">
              {Object.entries(customMetrics).map(([name, data]: [string, any]) => (
                <div key={name} className="bg-gray-800 p-3 rounded text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{name}</span>
                    <Badge variant="outline" className="text-xs">
                      {data.count} calls
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-gray-400">
                    <div>
                      <div>Avg</div>
                      <div className="text-white font-bold">
                        {data.avg.toFixed(0)}ms
                      </div>
                    </div>
                    <div>
                      <div>P95</div>
                      <div className="text-white font-bold">
                        {data.p95.toFixed(0)}ms
                      </div>
                    </div>
                    <div>
                      <div>Max</div>
                      <div className="text-white font-bold">
                        {data.max.toFixed(0)}ms
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memory Usage (if available) */}
        {(performance as any).memory && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-gray-300">
              Memory Usage
            </h4>
            <div className="bg-gray-800 p-3 rounded text-xs">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Used JS Heap</span>
                  <span className="font-bold">
                    {(
                      (performance as any).memory.usedJSHeapSize /
                      1024 /
                      1024
                    ).toFixed(1)}{" "}
                    MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total JS Heap</span>
                  <span className="font-bold">
                    {(
                      (performance as any).memory.totalJSHeapSize /
                      1024 /
                      1024
                    ).toFixed(1)}{" "}
                    MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Heap Limit</span>
                  <span className="font-bold">
                    {(
                      (performance as any).memory.jsHeapSizeLimit /
                      1024 /
                      1024
                    ).toFixed(1)}{" "}
                    MB
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="text-xs text-gray-400 space-y-1">
          <div>💡 Press Shift+Shift+P to toggle</div>
          <div>💡 Check console for detailed Web Vitals</div>
        </div>
      </div>
    </div>
  );
}

/**
 * 🎯 PERFORMANCE BADGE
 *
 * Simple badge showing current performance status.
 * Shows in development only.
 */
export function PerformanceBadge() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const monitor = PerformanceMonitor.getInstance();
      setStats(monitor.getStats());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (!stats || process.env.NODE_ENV !== "development") return null;

  const avgResponse = stats.avgResponseTime;
  const color =
    avgResponse < 200 ? "green" : avgResponse < 500 ? "yellow" : "red";

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-3 py-1 rounded-full text-xs font-medium bg-${color}-100 text-${color}-800 border border-${color}-300`}
    >
      {avgResponse.toFixed(0)}ms avg
    </div>
  );
}
