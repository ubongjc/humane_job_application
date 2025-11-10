"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Zap, FileText, Users, BarChart3, Settings, Sparkles, Command } from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category: "navigation" | "action" | "ai";
}

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  // All available commands
  const commands: CommandItem[] = useMemo(
    () => [
      // Navigation
      {
        id: "nav-dashboard",
        title: "Go to Dashboard",
        icon: <BarChart3 className="w-4 h-4" />,
        action: () => router.push("/dashboard"),
        keywords: ["home", "overview"],
        category: "navigation",
      },
      {
        id: "nav-jobs",
        title: "Go to Jobs",
        icon: <FileText className="w-4 h-4" />,
        action: () => router.push("/dashboard/jobs"),
        keywords: ["positions", "roles"],
        category: "navigation",
      },
      {
        id: "nav-candidates",
        title: "Go to Candidates",
        icon: <Users className="w-4 h-4" />,
        action: () => router.push("/dashboard/candidates"),
        keywords: ["applicants", "people"],
        category: "navigation",
      },
      {
        id: "nav-templates",
        title: "Go to Templates",
        icon: <FileText className="w-4 h-4" />,
        action: () => router.push("/dashboard/templates"),
        keywords: ["letters", "email"],
        category: "navigation",
      },
      {
        id: "nav-analytics",
        title: "Go to Analytics",
        icon: <BarChart3 className="w-4 h-4" />,
        action: () => router.push("/dashboard/analytics"),
        keywords: ["metrics", "stats", "reports"],
        category: "navigation",
      },
      {
        id: "nav-settings",
        title: "Go to Settings",
        icon: <Settings className="w-4 h-4" />,
        action: () => router.push("/dashboard/settings"),
        keywords: ["preferences", "config"],
        category: "navigation",
      },

      // Quick Actions
      {
        id: "action-new-job",
        title: "Create New Job",
        description: "Add a new job posting",
        icon: <Zap className="w-4 h-4" />,
        action: () => router.push("/dashboard/jobs/new"),
        keywords: ["add", "post", "position"],
        category: "action",
      },
      {
        id: "action-generate-letter",
        title: "Generate Rejection Letter",
        description: "AI-powered letter generation",
        icon: <Sparkles className="w-4 h-4" />,
        action: () => {
          // Trigger letter generation modal
          const event = new CustomEvent("open-letter-generator");
          window.dispatchEvent(event);
        },
        keywords: ["ai", "create", "write", "email"],
        category: "action",
      },
      {
        id: "action-bulk-send",
        title: "Bulk Send Letters",
        description: "Send to multiple candidates at once",
        icon: <Users className="w-4 h-4" />,
        action: () => {
          const event = new CustomEvent("open-bulk-send");
          window.dispatchEvent(event);
        },
        keywords: ["mass", "multiple", "batch"],
        category: "action",
      },
      {
        id: "action-import-candidates",
        title: "Import Candidates from CSV",
        description: "Bulk import from file",
        icon: <Users className="w-4 h-4" />,
        action: () => {
          const event = new CustomEvent("open-csv-import");
          window.dispatchEvent(event);
        },
        keywords: ["upload", "bulk", "file"],
        category: "action",
      },

      // AI Actions
      {
        id: "ai-help",
        title: "Ask AI Assistant",
        description: "Get help from AI Copilot",
        icon: <Sparkles className="w-4 h-4" />,
        action: () => {
          const event = new CustomEvent("open-ai-copilot");
          window.dispatchEvent(event);
        },
        keywords: ["help", "support", "assistant"],
        category: "ai",
      },
      {
        id: "ai-feedback",
        title: "Get AI Feedback Suggestions",
        description: "Generate constructive feedback points",
        icon: <Sparkles className="w-4 h-4" />,
        action: () => {
          const event = new CustomEvent("generate-feedback-suggestions");
          window.dispatchEvent(event);
        },
        keywords: ["suggestions", "ideas", "help"],
        category: "ai",
      },
    ],
    [router]
  );

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter((cmd) => {
      const titleMatch = cmd.title.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some((k) => k.includes(searchLower));
      return titleMatch || descMatch || keywordMatch;
    });
  }, [search, commands]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      action: [],
      ai: [],
    };

    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Open command palette with Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }

      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearch("");
      }
    };

    const handleCustomEvent = () => {
      setIsOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomEvent);
    };
  }, [isOpen]);

  const handleSelect = (command: CommandItem) => {
    command.action();
    setIsOpen(false);
    setSearch("");
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh] p-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 outline-none text-lg"
            autoFocus
          />
          <kbd className="px-2 py-1 bg-gray-100 text-xs rounded border">Esc</kbd>
        </div>

        {/* Command List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <p>No commands found</p>
              <p className="text-sm mt-2">Try searching for something else</p>
            </div>
          ) : (
            <>
              {groupedCommands.navigation.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Navigation
                  </div>
                  {groupedCommands.navigation.map((cmd) => (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        {cmd.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{cmd.title}</div>
                        {cmd.description && (
                          <div className="text-sm text-gray-500">{cmd.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {groupedCommands.action.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Actions
                  </div>
                  {groupedCommands.action.map((cmd) => (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                        {cmd.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{cmd.title}</div>
                        {cmd.description && (
                          <div className="text-sm text-gray-500">{cmd.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {groupedCommands.ai.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    AI Powered
                  </div>
                  {groupedCommands.ai.map((cmd) => (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                        {cmd.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{cmd.title}</div>
                        {cmd.description && (
                          <div className="text-sm text-gray-500">{cmd.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white rounded border">↑↓</kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white rounded border">Enter</kbd>
              <span>Select</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>Quick access</span>
          </div>
        </div>
      </div>
    </div>
  );
}
