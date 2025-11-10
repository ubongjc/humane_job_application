/**
 * CENTRAL BIAS DETECTION RULES
 *
 * Comprehensive, jurisdiction-aware bias detection for EEOC/GDPR compliance.
 * Used by letter generation, template linting, and red-team testing.
 */

export type BiasCategory =
  | "age"
  | "gender"
  | "race_ethnicity"
  | "disability"
  | "religion"
  | "pregnancy_family"
  | "appearance"
  | "health"
  | "accent_language"
  | "marital_status"
  | "cultural_fit";

export interface BiasRule {
  category: BiasCategory;
  pattern: RegExp;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  jurisdiction?: string[]; // If omitted, applies globally
  falsePositives?: RegExp[]; // Patterns that look like bias but aren't
}

export interface BiasDetectionResult {
  passed: boolean;
  warnings: BiasWarning[];
  score: number; // 0-100, higher is better
}

export interface BiasWarning {
  category: BiasCategory;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  match: string;
  position: number;
  suggestion?: string;
}

// ========================================
// Comprehensive Bias Rules
// ========================================

export const BIAS_RULES: BiasRule[] = [
  // ========================================
  // Age Discrimination (ADEA)
  // ========================================
  {
    category: "age",
    pattern: /\b(too (old|young)|age \d+|(over|under)qualified)\b/gi,
    severity: "critical",
    message: "Age-related language detected",
  },
  {
    category: "age",
    pattern:
      /\b(recent graduate|long career|decades of experience|entry.level only|senior|junior|youthful|mature|elderly)\b/gi,
    severity: "high",
    message: "Age proxy language detected",
  },
  {
    category: "age",
    pattern: /\b(digital native|tech savvy|energetic|traditional)\b/gi,
    severity: "medium",
    message: "Possible age stereotype",
  },

  // ========================================
  // Gender Discrimination (Title VII)
  // ========================================
  {
    category: "gender",
    pattern:
      /\b(he|she|him|her|his|hers|mr\.|mrs\.|miss|ma'am|sir|gentleman|lady)\b/gi,
    severity: "high",
    message: "Gendered language detected",
    falsePositives: [/\b(his|her) (qualifications|experience|skills)\b/gi], // Context-dependent
  },
  {
    category: "gender",
    pattern: /\b(aggressive|emotional|nurturing|dominant|submissive)\b/gi,
    severity: "medium",
    message: "Gender stereotype language",
  },

  // ========================================
  // Pregnancy/Family Status (PDA)
  // ========================================
  {
    category: "pregnancy_family",
    pattern:
      /\b(pregnant|pregnancy|maternity|paternity|family planning|childcare|children|kids|mother|father)\b/gi,
    severity: "critical",
    message: "Pregnancy/family status language detected",
  },
  {
    category: "pregnancy_family",
    pattern: /\b(marital status|married|single|divorced|widowed)\b/gi,
    severity: "critical",
    message: "Marital status reference detected",
  },

  // ========================================
  // Disability (ADA)
  // ========================================
  {
    category: "disability",
    pattern:
      /\b(disabled|disability|handicapped|wheelchair|blind|deaf|crippled|special needs)\b/gi,
    severity: "critical",
    message: "Disability-related language detected",
  },
  {
    category: "disability",
    pattern:
      /\b(mental (health|illness)|psychiatric|cognitive|physical limitation)\b/gi,
    severity: "critical",
    message: "Health/disability reference detected",
  },

  // ========================================
  // Race/Ethnicity (Title VII)
  // ========================================
  {
    category: "race_ethnicity",
    pattern:
      /\b(african|asian|hispanic|latino|latina|caucasian|white|black|brown|ethnic|minority|diversity)\b/gi,
    severity: "critical",
    message: "Race/ethnicity reference detected",
  },
  {
    category: "race_ethnicity",
    pattern: /\b(foreign|immigrant|non.native|accent)\b/gi,
    severity: "high",
    message: "National origin proxy detected",
  },

  // ========================================
  // Religion (Title VII)
  // ========================================
  {
    category: "religion",
    pattern:
      /\b(muslim|christian|jewish|hindu|buddhist|atheist|religious|faith|church|mosque|temple|synagogue)\b/gi,
    severity: "critical",
    message: "Religious reference detected",
  },

  // ========================================
  // Appearance/Physical Attributes
  // ========================================
  {
    category: "appearance",
    pattern:
      /\b(attractive|unattractive|overweight|thin|tall|short|appearance|looks|beautiful|handsome|ugly)\b/gi,
    severity: "high",
    message: "Physical appearance reference detected",
  },
  {
    category: "appearance",
    pattern: /\b(professional appearance|grooming|dress)\b/gi,
    severity: "medium",
    message: "Appearance-related language (may be context-dependent)",
  },

  // ========================================
  // Health (HIPAA concerns)
  // ========================================
  {
    category: "health",
    pattern:
      /\b(health condition|medical|illness|disease|sick|medication|treatment|diagnosis)\b/gi,
    severity: "critical",
    message: "Health/medical information reference (HIPAA concern)",
  },

  // ========================================
  // Accent/Language (National Origin)
  // ========================================
  {
    category: "accent_language",
    pattern:
      /\b(accent|pronunciation|native speaker|english proficiency|language barrier|communication skills)\b/gi,
    severity: "high",
    message: "Language/accent reference (potential national origin discrimination)",
  },

  // ========================================
  // Cultural Fit (Proxy for Protected Classes)
  // ========================================
  {
    category: "cultural_fit",
    pattern:
      /\b(not a (good )?fit|culture fit|doesn't fit (our|the) culture|wouldn't fit in)\b/gi,
    severity: "high",
    message:
      '"Culture fit" is often a proxy for discrimination - provide specific skill/behavior gaps instead',
  },
  {
    category: "cultural_fit",
    pattern: /\b(one of us|our kind of person|not our type)\b/gi,
    severity: "critical",
    message: "Exclusionary language detected",
  },
];

// ========================================
// Jurisdiction-Specific Additions
// ========================================

export const JURISDICTION_RULES: Record<string, BiasRule[]> = {
  EU: [
    // GDPR has stricter privacy rules
    {
      category: "health",
      pattern: /\b(personal (data|information)|sensitive data)\b/gi,
      severity: "high",
      message: "GDPR: Avoid references to personal data categories",
    },
  ],
  CA: [
    // California CCPA/FEHA
    {
      category: "age",
      pattern: /\b(recent grad|new grad|entry.level)\b/gi,
      severity: "medium",
      message: "CA FEHA: Age proxy language",
    },
  ],
};

// ========================================
// Bias Detection Engine
// ========================================

export class BiasDetector {
  private rules: BiasRule[];

  constructor(jurisdiction: string = "US") {
    // Combine global rules with jurisdiction-specific rules
    this.rules = [
      ...BIAS_RULES,
      ...(JURISDICTION_RULES[jurisdiction] || []),
    ];
  }

  /**
   * Detect bias in text
   */
  detect(text: string): BiasDetectionResult {
    const warnings: BiasWarning[] = [];

    for (const rule of this.rules) {
      const matches = text.matchAll(rule.pattern);

      for (const match of matches) {
        // Check false positives
        if (rule.falsePositives) {
          const isFalsePositive = rule.falsePositives.some((fp) =>
            fp.test(match[0])
          );
          if (isFalsePositive) continue;
        }

        warnings.push({
          category: rule.category,
          severity: rule.severity,
          message: rule.message,
          match: match[0],
          position: match.index || 0,
          suggestion: this.getSuggestion(rule.category),
        });
      }
    }

    // Calculate score (0-100)
    const score = this.calculateScore(warnings);

    return {
      passed: warnings.length === 0 || score >= 80,
      warnings,
      score,
    };
  }

  /**
   * Calculate bias score (0-100, higher is better)
   */
  private calculateScore(warnings: BiasWarning[]): number {
    if (warnings.length === 0) return 100;

    let deductions = 0;
    for (const warning of warnings) {
      switch (warning.severity) {
        case "critical":
          deductions += 25;
          break;
        case "high":
          deductions += 15;
          break;
        case "medium":
          deductions += 5;
          break;
        case "low":
          deductions += 2;
          break;
      }
    }

    return Math.max(0, 100 - deductions);
  }

  /**
   * Get suggestion for fixing bias
   */
  private getSuggestion(category: BiasCategory): string {
    const suggestions: Record<BiasCategory, string> = {
      age: "Focus on specific skills and experience, not tenure or age proxies",
      gender: "Use gender-neutral language (they/them) and avoid stereotypes",
      race_ethnicity:
        "Never reference race, ethnicity, or national origin. Focus on qualifications.",
      disability:
        "Never reference health or disability. Focus on required job functions.",
      religion:
        "Religious affiliation is never relevant. Remove all references.",
      pregnancy_family:
        "Family status is irrelevant. Focus on job qualifications only.",
      appearance:
        "Physical appearance is not a valid criterion. Remove references.",
      health:
        "Health information is protected (HIPAA). Never include in letters.",
      accent_language:
        'If communication skills are truly required, describe specific business needs, not "accent"',
      marital_status:
        "Marital/family status is protected. Never include in decisions.",
      cultural_fit:
        'Avoid vague "culture fit" - specify actual skill/behavior gaps instead',
    };

    return suggestions[category];
  }

  /**
   * Get all rules for a category
   */
  getRules(category?: BiasCategory): BiasRule[] {
    if (!category) return this.rules;
    return this.rules.filter((r) => r.category === category);
  }
}

/**
 * Helper: Quick bias check
 */
export function checkBias(
  text: string,
  jurisdiction: string = "US"
): BiasDetectionResult {
  const detector = new BiasDetector(jurisdiction);
  return detector.detect(text);
}

/**
 * Helper: Format warnings for display
 */
export function formatBiasWarnings(warnings: BiasWarning[]): string {
  if (warnings.length === 0) return "No bias detected ✅";

  return warnings
    .map(
      (w, i) =>
        `${i + 1}. [${w.severity.toUpperCase()}] ${w.message}\n   Found: "${w.match}"\n   Fix: ${w.suggestion}`
    )
    .join("\n\n");
}
