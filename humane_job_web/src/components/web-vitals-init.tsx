"use client";

/**
 * 📊 WEB VITALS INITIALIZER
 *
 * Client component to initialize Web Vitals tracking.
 * Must be client-side since Web Vitals uses browser APIs.
 */

import { useEffect } from "react";
import { initWebVitals } from "@/lib/performance/web-vitals";

export function WebVitalsInit() {
  useEffect(() => {
    // Initialize Web Vitals tracking
    initWebVitals();
  }, []);

  return null; // This component renders nothing
}
