"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "lucide-react";

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: Shortcut[] = [
    {
      key: "Cmd+K",
      description: "Open command palette",
      action: () => {
        // Trigger command palette
        const event = new CustomEvent("open-command-palette");
        window.dispatchEvent(event);
      },
    },
    {
      key: "G then D",
      description: "Go to Dashboard",
      action: () => router.push("/dashboard"),
    },
    {
      key: "G then J",
      description: "Go to Jobs",
      action: () => router.push("/dashboard/jobs"),
    },
    {
      key: "G then C",
      description: "Go to Candidates",
      action: () => router.push("/dashboard/candidates"),
    },
    {
      key: "G then T",
      description: "Go to Templates",
      action: () => router.push("/dashboard/templates"),
    },
    {
      key: "G then A",
      description: "Go to Analytics",
      action: () => router.push("/dashboard/analytics"),
    },
    {
      key: "N",
      description: "Create new job",
      action: () => router.push("/dashboard/jobs/new"),
    },
    {
      key: "?",
      description: "Show keyboard shortcuts",
      action: () => setShowHelp((prev) => !prev),
    },
    {
      key: "Escape",
      description: "Close modals/dialogs",
      action: () => {
        // Close any open modals
        const event = new CustomEvent("close-all-modals");
        window.dispatchEvent(event);
      },
    },
  ];

  useEffect(() => {
    let gPressed = false;
    let gTimer: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      // Cmd/Ctrl + K - Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const event = new CustomEvent("open-command-palette");
        window.dispatchEvent(event);
        return;
      }

      // Don't process other shortcuts when typing
      if (isInput && e.key !== "Escape") return;

      // Escape - Close modals
      if (e.key === "Escape") {
        setShowHelp(false);
        const event = new CustomEvent("close-all-modals");
        window.dispatchEvent(event);
        return;
      }

      // ? - Show help
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // G+X navigation shortcuts
      if (e.key.toLowerCase() === "g" && !isInput) {
        e.preventDefault();
        gPressed = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => {
          gPressed = false;
        }, 1000);
        return;
      }

      if (gPressed && !isInput) {
        e.preventDefault();
        switch (e.key.toLowerCase()) {
          case "d":
            router.push("/dashboard");
            break;
          case "j":
            router.push("/dashboard/jobs");
            break;
          case "c":
            router.push("/dashboard/candidates");
            break;
          case "t":
            router.push("/dashboard/templates");
            break;
          case "a":
            router.push("/dashboard/analytics");
            break;
        }
        gPressed = false;
      }

      // N - New job
      if (e.key.toLowerCase() === "n" && !isInput) {
        e.preventDefault();
        router.push("/dashboard/jobs/new");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(gTimer);
    };
  }, [router]);

  // Help modal
  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Command className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Close</span>
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Navigation</h3>
            <div className="space-y-2">
              {shortcuts
                .filter((s) => s.description.startsWith("Go to"))
                .map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <span className="text-gray-700">{shortcut.description}</span>
                    <kbd className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
            <div className="space-y-2">
              {shortcuts
                .filter((s) => !s.description.startsWith("Go to") && !s.description.includes("Show") && !s.description.includes("Close"))
                .map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <span className="text-gray-700">{shortcut.description}</span>
                    <kbd className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">General</h3>
            <div className="space-y-2">
              {shortcuts
                .filter((s) => s.description.includes("Show") || s.description.includes("Close"))
                .map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <span className="text-gray-700">{shortcut.description}</span>
                    <kbd className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600">
            Press <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </div>
  );
}
