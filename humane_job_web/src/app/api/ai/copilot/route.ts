import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/copilot
 * AI Copilot assistant for helping users navigate the platform
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, context } = await req.json();

    // Build system prompt based on context
    const systemPrompt = buildSystemPrompt(context);

    // Convert messages to OpenAI format
    const openaiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = completion.choices[0]?.message?.content || "I'm not sure how to help with that.";

    // Generate contextual suggestions
    const suggestions = generateSuggestions(assistantMessage, context);

    return NextResponse.json({
      message: assistantMessage,
      suggestions,
    });
  } catch (error) {
    console.error("Copilot error:", error);
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(context: any): string {
  const basePrompt = `You are a helpful AI assistant for the Humane Job Application platform. This platform helps companies send humane, bias-free rejection letters to candidates.

Your role is to:
1. Guide users through the platform features
2. Answer questions about best practices for rejection letters
3. Help users understand analytics and metrics
4. Provide suggestions for improving candidate experience
5. Assist with technical issues

Always be:
- Concise and helpful (max 3-4 sentences)
- Professional but friendly
- Focused on reducing user stress
- Proactive in suggesting next steps

Key platform features:
- AI-powered letter generation with bias detection
- Bulk sending capabilities
- Analytics and reporting
- Template management
- GDPR/CCPA compliance tools`;

  if (context?.page) {
    const contextPrompts = {
      jobs: "\n\nCurrent context: User is on the Jobs page. Help with creating jobs, managing postings, or understanding rubrics.",
      candidates: "\n\nCurrent context: User is on the Candidates page. Help with candidate management, bulk operations, or importing data.",
      "letter-generation": "\n\nCurrent context: User is generating a rejection letter. Focus on feedback quality, tone, and bias prevention.",
      analytics: "\n\nCurrent context: User is viewing analytics. Help interpret metrics and provide actionable insights.",
      templates: "\n\nCurrent context: User is managing templates. Help with customization and best practices.",
    };

    return basePrompt + (contextPrompts[context.page as keyof typeof contextPrompts] || "");
  }

  return basePrompt;
}

function generateSuggestions(message: string, context: any): string[] {
  // Smart suggestions based on message content
  const suggestions: string[] = [];

  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("create") || lowerMessage.includes("new")) {
    suggestions.push("Show me how to do this");
  }

  if (lowerMessage.includes("letter") || lowerMessage.includes("email")) {
    suggestions.push("Generate a sample letter");
  }

  if (lowerMessage.includes("bulk") || lowerMessage.includes("multiple")) {
    suggestions.push("Guide me through bulk sending");
  }

  if (lowerMessage.includes("bias") || lowerMessage.includes("compliance")) {
    suggestions.push("Check my feedback for bias");
  }

  if (lowerMessage.includes("template")) {
    suggestions.push("Show me template options");
  }

  // Context-specific suggestions
  if (context?.page === "candidates" && suggestions.length < 2) {
    suggestions.push("Import candidates from CSV");
  }

  if (context?.page === "jobs" && suggestions.length < 2) {
    suggestions.push("Set up interview rubrics");
  }

  // Always offer to continue the conversation
  if (suggestions.length < 3) {
    suggestions.push("Tell me more");
  }

  return suggestions.slice(0, 3);
}
