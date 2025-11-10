/**
 * LLM PROVIDER ABSTRACTION
 *
 * Provider-agnostic interface with:
 * - Primary + fallback provider support
 * - Timeout and budget enforcement
 * - Banned phrase filtering
 * - Temperature caps
 * - Deterministic retry policy
 * - Idempotency keys
 */

import OpenAI from "openai";
import * as Sentry from "@sentry/nextjs";

// ========================================
// Types
// ========================================

export type LLMProvider = "openai" | "anthropic" | "cohere" | "stub";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  timeout?: number; // milliseconds
  maxTokens?: number;
  temperature?: number; // Capped at 0.8 for safety
  topP?: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  config?: Partial<LLMConfig>;
  idempotencyKey?: string;
  bannedPhrases?: string[]; // Additional banned phrases for this request
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  cached: boolean;
}

export interface SafetyViolation {
  type: "banned_phrase" | "excessive_tokens" | "temperature_cap" | "timeout";
  message: string;
  phrase?: string;
}

// ========================================
// Banned Phrases (Global Blocklist)
// ========================================

const GLOBAL_BANNED_PHRASES = [
  // Protected classes (should NEVER appear in letters)
  /\b(too old|too young|age \d+|elderly|senior citizen)\b/gi,
  /\b(pregnant|pregnancy|maternity|paternity)\b/gi,
  /\b(disabled|disability|handicapped|wheelchair)\b/gi,
  /\b(muslim|christian|jewish|hindu|buddhist|religious)\b/gi,
  /\b(married|single|divorced|widowed|marital status)\b/gi,
  /\b(accent|foreign|non-native|english as second language)\b/gi,

  // Health speculation (HIPAA/privacy concern)
  /\b(health condition|medical|illness|disease|mental health)\b/gi,

  // Appearance/personal attributes
  /\b(attractive|unattractive|overweight|thin|tall|short|appearance)\b/gi,

  // Discriminatory language
  /\b(not a good fit culturally|culture fit concerns)\b/gi,

  // Absolute negatives (too harsh)
  /\b(incompetent|useless|terrible|worst|pathetic|stupid)\b/gi,
];

// ========================================
// LLM Provider Implementation
// ========================================

class LLMProviderService {
  private primaryConfig: LLMConfig;
  private fallbackConfig?: LLMConfig;
  private openaiClient?: OpenAI;
  private cache: Map<string, LLMResponse> = new Map();

  constructor() {
    // Primary: OpenAI GPT-4
    this.primaryConfig = {
      provider: "openai",
      model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30s
      maxTokens: 2000,
      temperature: 0.7,
    };

    // Fallback: OpenAI GPT-3.5-Turbo (faster, cheaper)
    if (process.env.OPENAI_API_KEY) {
      this.fallbackConfig = {
        provider: "openai",
        model: "gpt-3.5-turbo",
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 20000, // 20s
        maxTokens: 2000,
        temperature: 0.7,
      };
    }

    // Initialize OpenAI client
    if (this.primaryConfig.apiKey) {
      this.openaiClient = new OpenAI({
        apiKey: this.primaryConfig.apiKey,
      });
    }
  }

  /**
   * Generate text with automatic fallback
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    // Check cache (idempotency)
    if (request.idempotencyKey && this.cache.has(request.idempotencyKey)) {
      const cached = this.cache.get(request.idempotencyKey)!;
      Sentry.addBreadcrumb({
        category: "llm",
        message: "Cache hit",
        level: "info",
        data: { idempotencyKey: request.idempotencyKey },
      });
      return { ...cached, cached: true };
    }

    // Validate and sanitize config
    const config = this.sanitizeConfig({
      ...this.primaryConfig,
      ...request.config,
    });

    try {
      // Try primary provider
      const response = await this.generateWithProvider(
        request.messages,
        config,
        "primary"
      );

      // Check for banned phrases
      const violations = this.checkBannedPhrases(
        response.content,
        request.bannedPhrases
      );
      if (violations.length > 0) {
        throw new SafetyError(violations);
      }

      // Cache result
      if (request.idempotencyKey) {
        this.cache.set(request.idempotencyKey, response);
        // Expire cache after 1 hour
        setTimeout(() => {
          this.cache.delete(request.idempotencyKey!);
        }, 3600000);
      }

      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        category: "llm",
        message: "Generation successful",
        level: "info",
        data: {
          provider: response.provider,
          model: response.model,
          duration,
          tokens: response.usage?.totalTokens,
        },
      });

      return response;
    } catch (error) {
      // If safety violation, don't retry
      if (error instanceof SafetyError) {
        Sentry.captureException(error, {
          tags: { provider: config.provider },
          extra: { violations: error.violations },
        });
        throw error;
      }

      // Try fallback provider
      if (this.fallbackConfig) {
        Sentry.addBreadcrumb({
          category: "llm",
          message: "Primary failed, trying fallback",
          level: "warning",
          data: { error: (error as Error).message },
        });

        try {
          const fallbackConfig = this.sanitizeConfig({
            ...this.fallbackConfig,
            ...request.config,
          });

          const response = await this.generateWithProvider(
            request.messages,
            fallbackConfig,
            "fallback"
          );

          // Check banned phrases again
          const violations = this.checkBannedPhrases(
            response.content,
            request.bannedPhrases
          );
          if (violations.length > 0) {
            throw new SafetyError(violations);
          }

          const duration = Date.now() - startTime;
          Sentry.addBreadcrumb({
            category: "llm",
            message: "Fallback successful",
            level: "info",
            data: {
              provider: response.provider,
              duration,
              tokens: response.usage?.totalTokens,
            },
          });

          return response;
        } catch (fallbackError) {
          Sentry.captureException(fallbackError, {
            tags: { provider: "fallback", source: "llm" },
          });
          throw new Error(
            `Both primary and fallback providers failed: ${(error as Error).message}, ${(fallbackError as Error).message}`
          );
        }
      }

      // No fallback available
      Sentry.captureException(error, {
        tags: { provider: config.provider },
      });
      throw error;
    }
  }

  /**
   * Generate with specific provider
   */
  private async generateWithProvider(
    messages: LLMMessage[],
    config: LLMConfig,
    type: "primary" | "fallback"
  ): Promise<LLMResponse> {
    switch (config.provider) {
      case "openai":
        return this.generateOpenAI(messages, config, type);
      case "stub":
        return this.generateStub(messages, config, type);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * OpenAI implementation
   */
  private async generateOpenAI(
    messages: LLMMessage[],
    config: LLMConfig,
    type: "primary" | "fallback"
  ): Promise<LLMResponse> {
    if (!this.openaiClient) {
      throw new Error("OpenAI client not initialized");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, config.timeout || 30000);

    try {
      const completion = await this.openaiClient.chat.completions.create(
        {
          model: config.model,
          messages: messages as any,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          top_p: config.topP,
        },
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      return {
        content: completion.choices[0].message.content || "",
        provider: "openai",
        model: config.model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        finishReason: completion.choices[0].finish_reason,
        cached: false,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Stub provider for testing/canary
   */
  private async generateStub(
    messages: LLMMessage[],
    config: LLMConfig,
    type: "primary" | "fallback"
  ): Promise<LLMResponse> {
    // Simulate delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      content:
        "Thank you for your interest in this position. After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs. We appreciate the time you invested in the interview process and wish you the best in your job search.",
      provider: "stub",
      model: "stub-1.0",
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      finishReason: "stop",
      cached: false,
    };
  }

  /**
   * Sanitize and enforce safety limits on config
   */
  private sanitizeConfig(config: Partial<LLMConfig>): LLMConfig {
    return {
      provider: config.provider || "openai",
      model: config.model || "gpt-4-turbo-preview",
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      timeout: Math.min(config.timeout || 30000, 60000), // Max 60s
      maxTokens: Math.min(config.maxTokens || 2000, 4000), // Max 4k tokens
      temperature: Math.min(config.temperature || 0.7, 0.8), // Cap at 0.8
      topP: config.topP,
    };
  }

  /**
   * Check for banned phrases in generated content
   */
  private checkBannedPhrases(
    content: string,
    additionalBanned?: string[]
  ): SafetyViolation[] {
    const violations: SafetyViolation[] = [];

    // Check global banned phrases
    for (const pattern of GLOBAL_BANNED_PHRASES) {
      const match = content.match(pattern);
      if (match) {
        violations.push({
          type: "banned_phrase",
          message: `Banned phrase detected: ${match[0]}`,
          phrase: match[0],
        });
      }
    }

    // Check additional banned phrases
    if (additionalBanned) {
      for (const phrase of additionalBanned) {
        if (content.toLowerCase().includes(phrase.toLowerCase())) {
          violations.push({
            type: "banned_phrase",
            message: `Banned phrase detected: ${phrase}`,
            phrase,
          });
        }
      }
    }

    return violations;
  }

  /**
   * Clear cache (for testing)
   */
  clearCache() {
    this.cache.clear();
  }
}

// ========================================
// Custom Errors
// ========================================

export class SafetyError extends Error {
  constructor(public violations: SafetyViolation[]) {
    super(`Safety violations detected: ${violations.map((v) => v.message).join(", ")}`);
    this.name = "SafetyError";
  }
}

// ========================================
// Singleton Instance
// ========================================

export const llmProvider = new LLMProviderService();

/**
 * Helper function for backwards compatibility
 */
export async function generateText(request: LLMRequest): Promise<LLMResponse> {
  return llmProvider.generate(request);
}
