/**
 * TEMPLATE LINTING & GUARDRAILS
 *
 * Enforces safety rules on letter templates:
 * - No protected class inference
 * - No health/age speculation
 * - Required placeholders must exist
 * - Token/length budgets
 * - Bias detection
 * - Source rubric fields for specific feedback
 */

import { checkBias, BiasWarning } from "@/lib/ethics/bias_rules";

export interface LintRule {
  id: string;
  name: string;
  severity: "error" | "warning" | "info";
  check: (template: string, context: TemplateContext) => LintViolation | null;
}

export interface TemplateContext {
  locale: string;
  jurisdiction: string;
  requiredPlaceholders?: string[];
  rubricFields?: string[];
  maxTokens?: number;
  maxLength?: number;
}

export interface LintViolation {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface LintResult {
  passed: boolean;
  errors: LintViolation[];
  warnings: LintViolation[];
  info: LintViolation[];
  score: number; // 0-100
}

// ========================================
// Required Placeholders (must exist in every template)
// ========================================

const REQUIRED_PLACEHOLDERS = [
  "{{candidateName}}",
  "{{jobTitle}}",
  "{{companyName}}",
];

const RECOMMENDED_PLACEHOLDERS = [
  "{{date}}",
  "{{recipientEmail}}",
  "{{feedbackSummary}}",
];

// ========================================
// Forbidden Phrases (should never appear in templates)
// ========================================

const FORBIDDEN_PHRASES = [
  // Absolute negatives
  /\b(incompetent|useless|terrible|worst|pathetic|stupid|horrible)\b/gi,
  /\b(you (will )?never|you (will )?fail|you can't|you're not capable)\b/gi,

  // Misleading promises
  /\b(we (will|may) consider you (for )?future|keep (your )?resume on file)\b/gi,

  // Vague/meaningless
  /\b(not a good fit|doesn't match our culture|not right for us)\b/gi,

  // Health/personal speculation
  /\b(you seem|you appear to be|we noticed you)\b/gi,
];

// ========================================
// Lint Rules
// ========================================

export const TEMPLATE_LINT_RULES: LintRule[] = [
  // Rule 1: Required placeholders must exist
  {
    id: "required-placeholders",
    name: "Required Placeholders",
    severity: "error",
    check: (template, context) => {
      const required = context.requiredPlaceholders || REQUIRED_PLACEHOLDERS;
      const missing = required.filter(
        (placeholder) => !template.includes(placeholder)
      );

      if (missing.length > 0) {
        return {
          rule: "required-placeholders",
          severity: "error",
          message: `Missing required placeholders: ${missing.join(", ")}`,
          suggestion: `Add these placeholders to your template: ${missing.join(", ")}`,
        };
      }
      return null;
    },
  },

  // Rule 2: Recommended placeholders
  {
    id: "recommended-placeholders",
    name: "Recommended Placeholders",
    severity: "warning",
    check: (template, context) => {
      const missing = RECOMMENDED_PLACEHOLDERS.filter(
        (placeholder) => !template.includes(placeholder)
      );

      if (missing.length > 0) {
        return {
          rule: "recommended-placeholders",
          severity: "warning",
          message: `Consider adding: ${missing.join(", ")}`,
          suggestion: `These placeholders improve personalization and clarity.`,
        };
      }
      return null;
    },
  },

  // Rule 3: Forbidden phrases
  {
    id: "forbidden-phrases",
    name: "Forbidden Phrases",
    severity: "error",
    check: (template) => {
      for (const pattern of FORBIDDEN_PHRASES) {
        const match = template.match(pattern);
        if (match) {
          return {
            rule: "forbidden-phrases",
            severity: "error",
            message: `Forbidden phrase detected: "${match[0]}"`,
            suggestion:
              "Use constructive, respectful language. Focus on job-specific qualifications.",
          };
        }
      }
      return null;
    },
  },

  // Rule 4: Bias detection
  {
    id: "bias-check",
    name: "Bias Detection",
    severity: "error",
    check: (template, context) => {
      const biasResult = checkBias(template, context.jurisdiction);

      if (!biasResult.passed) {
        const critical = biasResult.warnings.filter(
          (w) => w.severity === "critical"
        );
        if (critical.length > 0) {
          return {
            rule: "bias-check",
            severity: "error",
            message: `Bias detected: ${critical.map((w) => w.match).join(", ")}`,
            suggestion: critical[0].suggestion,
          };
        }

        const high = biasResult.warnings.filter((w) => w.severity === "high");
        if (high.length > 0) {
          return {
            rule: "bias-check",
            severity: "warning",
            message: `Potential bias: ${high.map((w) => w.match).join(", ")}`,
            suggestion: high[0].suggestion,
          };
        }
      }
      return null;
    },
  },

  // Rule 5: Length budget
  {
    id: "length-budget",
    name: "Length Budget",
    severity: "warning",
    check: (template, context) => {
      const maxLength = context.maxLength || 2000;
      if (template.length > maxLength) {
        return {
          rule: "length-budget",
          severity: "warning",
          message: `Template exceeds maximum length (${template.length} / ${maxLength} chars)`,
          suggestion: "Keep rejection letters concise and respectful.",
        };
      }
      return null;
    },
  },

  // Rule 6: Token budget (estimate)
  {
    id: "token-budget",
    name: "Token Budget",
    severity: "warning",
    check: (template, context) => {
      const maxTokens = context.maxTokens || 500;
      // Rough estimate: ~4 chars per token
      const estimatedTokens = Math.ceil(template.length / 4);

      if (estimatedTokens > maxTokens) {
        return {
          rule: "token-budget",
          severity: "warning",
          message: `Template may exceed token budget (~${estimatedTokens} / ${maxTokens} tokens)`,
          suggestion: "Reduce template length to stay within LLM token limits.",
        };
      }
      return null;
    },
  },

  // Rule 7: Specific feedback requires rubric source
  {
    id: "rubric-source",
    name: "Rubric Source Required",
    severity: "warning",
    check: (template, context) => {
      // Check if template contains specific feedback sentences
      const specificFeedbackPatterns = [
        /{{rubric\./gi,
        /{{feedback\./gi,
        /{{score\./gi,
      ];

      const hasSpecificFeedback = specificFeedbackPatterns.some((pattern) =>
        pattern.test(template)
      );

      if (hasSpecificFeedback && !context.rubricFields) {
        return {
          rule: "rubric-source",
          severity: "warning",
          message:
            "Template includes specific feedback but no rubric fields defined",
          suggestion:
            "Ensure all specific feedback comes from structured rubric data.",
        };
      }
      return null;
    },
  },

  // Rule 8: No empty template
  {
    id: "non-empty",
    name: "Non-Empty Template",
    severity: "error",
    check: (template) => {
      if (template.trim().length === 0) {
        return {
          rule: "non-empty",
          severity: "error",
          message: "Template cannot be empty",
          suggestion: "Add template content.",
        };
      }
      return null;
    },
  },

  // Rule 9: Professional tone
  {
    id: "professional-tone",
    name: "Professional Tone",
    severity: "warning",
    check: (template) => {
      const unprofessionalPatterns = [
        /\b(hey|hi there|yo|sup|cool|awesome|dude|guys)\b/gi,
        /!!+/g, // Multiple exclamation marks
        /\?\?+/g, // Multiple question marks
        /[A-Z]{5,}/g, // ALL CAPS
      ];

      for (const pattern of unprofessionalPatterns) {
        const match = template.match(pattern);
        if (match) {
          return {
            rule: "professional-tone",
            severity: "warning",
            message: `Unprofessional language detected: "${match[0]}"`,
            suggestion: "Use formal, respectful business language.",
          };
        }
      }
      return null;
    },
  },

  // Rule 10: Grammatical completeness
  {
    id: "grammatical-completeness",
    name: "Grammatical Completeness",
    severity: "info",
    check: (template) => {
      // Check for common grammatical issues
      const issues = [];

      // Missing punctuation at end
      if (!/[.!?]$/.test(template.trim())) {
        issues.push("Template should end with proper punctuation");
      }

      // Double spaces
      if (/  +/.test(template)) {
        issues.push("Remove extra spaces");
      }

      // Missing space after punctuation
      if (/[.!?,][A-Z]/.test(template)) {
        issues.push("Add space after punctuation");
      }

      if (issues.length > 0) {
        return {
          rule: "grammatical-completeness",
          severity: "info",
          message: issues.join("; "),
          suggestion: "Review template for grammatical correctness.",
        };
      }
      return null;
    },
  },
];

// ========================================
// Template Linter
// ========================================

export class TemplateLinter {
  private rules: LintRule[];

  constructor(customRules: LintRule[] = []) {
    this.rules = [...TEMPLATE_LINT_RULES, ...customRules];
  }

  /**
   * Lint a template
   */
  lint(template: string, context: TemplateContext): LintResult {
    const errors: LintViolation[] = [];
    const warnings: LintViolation[] = [];
    const info: LintViolation[] = [];

    // Run all rules
    for (const rule of this.rules) {
      const violation = rule.check(template, context);
      if (violation) {
        switch (violation.severity) {
          case "error":
            errors.push(violation);
            break;
          case "warning":
            warnings.push(violation);
            break;
          case "info":
            info.push(violation);
            break;
        }
      }
    }

    // Calculate score
    const score = this.calculateScore(errors, warnings, info);

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      info,
      score,
    };
  }

  /**
   * Calculate quality score (0-100)
   */
  private calculateScore(
    errors: LintViolation[],
    warnings: LintViolation[],
    info: LintViolation[]
  ): number {
    let deductions = 0;

    deductions += errors.length * 20; // Each error: -20 points
    deductions += warnings.length * 10; // Each warning: -10 points
    deductions += info.length * 2; // Each info: -2 points

    return Math.max(0, 100 - deductions);
  }

  /**
   * Add custom rule
   */
  addRule(rule: LintRule) {
    this.rules.push(rule);
  }

  /**
   * Get all rules
   */
  getRules(): LintRule[] {
    return this.rules;
  }
}

// ========================================
// Helpers
// ========================================

/**
 * Lint template (convenience function)
 */
export function lintTemplate(
  template: string,
  context: TemplateContext
): LintResult {
  const linter = new TemplateLinter();
  return linter.lint(template, context);
}

/**
 * Format lint result for display
 */
export function formatLintResult(result: LintResult): string {
  let output = `Template Quality Score: ${result.score}/100\n\n`;

  if (result.errors.length > 0) {
    output += "❌ ERRORS:\n";
    result.errors.forEach((e, i) => {
      output += `${i + 1}. ${e.message}\n`;
      if (e.suggestion) output += `   Fix: ${e.suggestion}\n`;
    });
    output += "\n";
  }

  if (result.warnings.length > 0) {
    output += "⚠️  WARNINGS:\n";
    result.warnings.forEach((w, i) => {
      output += `${i + 1}. ${w.message}\n`;
      if (w.suggestion) output += `   Suggestion: ${w.suggestion}\n`;
    });
    output += "\n";
  }

  if (result.info.length > 0) {
    output += "ℹ️  INFO:\n";
    result.info.forEach((info, i) => {
      output += `${i + 1}. ${info.message}\n`;
    });
  }

  if (result.passed && result.warnings.length === 0 && result.info.length === 0) {
    output += "✅ Template passed all checks!\n";
  }

  return output;
}
