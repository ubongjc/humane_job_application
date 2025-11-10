"use client";

/**
 * 🎯 DASHBOARD FEATURES WRAPPER
 *
 * Client-side components for the dashboard.
 * Includes AI Copilot, Command Palette, and Keyboard Shortcuts.
 */

import { AICopilot } from "@/components/ai-copilot";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

interface DashboardFeaturesProps {
  /**
   * Current page context for AI Copilot
   */
  context?: {
    page: string;
    jobId?: string;
    candidateId?: string;
  };
}

export function DashboardFeatures({ context }: DashboardFeaturesProps) {
  return (
    <>
      {/* AI Copilot - Floating assistant */}
      <AICopilot context={context} />

      {/* Command Palette - Cmd+K */}
      <CommandPalette />

      {/* Keyboard Shortcuts - All shortcuts */}
      <KeyboardShortcuts />
    </>
  );
}
