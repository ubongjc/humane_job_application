"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Message {
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface AICopilotProps {
  context?: {
    page: string;
    jobId?: string;
    candidateId?: string;
  };
}

export function AICopilot({ context }: AICopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Smart initial greeting based on context
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = getContextualGreeting(context);
      setMessages([
        {
          role: "assistant",
          content: greeting.message,
          timestamp: new Date(),
          suggestions: greeting.suggestions,
        },
      ]);
    }
  }, [isOpen, context]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        suggestions: data.suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Copilot error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
          aria-label="Open AI Copilot"
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-medium">AI Assistant</span>
        </button>
      )}

      {/* Copilot Panel */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 z-50 w-96 h-[600px] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">AI Copilot</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 rounded p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs opacity-75">Quick actions:</p>
                      {message.suggestions.map((suggestion, sidx) => (
                        <button
                          key={sidx}
                          onClick={() => handleSuggestion(suggestion)}
                          className="block w-full text-left text-xs bg-white/10 hover:bg-white/20 rounded px-2 py-1.5 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              AI-powered assistance • Always improving
            </p>
          </div>
        </Card>
      )}
    </>
  );
}

function getContextualGreeting(context?: AICopilotProps["context"]) {
  if (!context) {
    return {
      message:
        "Hi! I'm your AI assistant. I can help you with generating rejection letters, managing candidates, and answering questions about the platform.",
      suggestions: [
        "Generate a rejection letter",
        "How do I send bulk emails?",
        "Show me analytics",
      ],
    };
  }

  switch (context.page) {
    case "jobs":
      return {
        message:
          "I can help you create jobs, manage job postings, or answer questions about hiring workflows.",
        suggestions: [
          "Create a new job posting",
          "How do I set up interview rubrics?",
          "Show me job templates",
        ],
      };

    case "candidates":
      return {
        message:
          "I can help you manage candidates, generate rejection letters, or provide feedback suggestions.",
        suggestions: [
          "Generate rejection letters for selected candidates",
          "How do I import candidates from CSV?",
          "Show me candidate pipeline",
        ],
      };

    case "letter-generation":
      return {
        message:
          "I'll help you generate a humane, bias-free rejection letter. What feedback points would you like to include?",
        suggestions: [
          "Generate letter with constructive feedback",
          "Check for bias in my feedback",
          "Use empathetic tone",
        ],
      };

    case "analytics":
      return {
        message:
          "I can explain your metrics, provide insights, or help you improve your hiring process.",
        suggestions: [
          "Why is my bias check pass rate low?",
          "How can I improve candidate experience?",
          "Export analytics report",
        ],
      };

    default:
      return {
        message:
          "Hi! I'm here to help you with anything related to sending humane rejection letters. What can I assist you with?",
        suggestions: [
          "Guide me through the platform",
          "How do I send my first rejection letter?",
          "Best practices for feedback",
        ],
      };
  }
}
