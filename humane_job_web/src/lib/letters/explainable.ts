/**
 * EXPLAINABLE FEEDBACK CARD (XFC)
 *
 * Generates machine-readable, candidate-facing explanations of rejection decisions
 * based on rubric score deltas. Contains ONLY non-protected attributes and
 * actionable feedback.
 *
 * The XFC is:
 * - Transparent: Shows actual rubric-based reasons
 * - Fair: No protected class information
 * - Actionable: Candidates know what to improve
 * - Auditable: Cryptographically signed
 */

import crypto from "crypto";

// ========================================
// Types
// ========================================

export interface RubricCriterion {
  name: string;
  weight: number; // 0-1
  description?: string;
}

export interface CandidateScore {
  criterion: string;
  score: number; // 1-5
  evidence?: string; // Optional interviewer comment
  weight: number;
}

export interface RubricDelta {
  criterion: string;
  candidateScore: number;
  threshold: number; // Minimum passing score
  delta: number; // candidateScore - threshold (negative means below bar)
  weight: number;
  evidence?: string;
  isDeficient: boolean; // True if delta < 0
}

export interface ExplainableCard {
  version: string; // Schema version
  decisionId: string;
  candidateEmail: string;
  jobTitle: string;
  locale: string; // For localized messages
  reasons: string[]; // Human-readable summary reasons
  rubricDeltas: RubricDelta[]; // Detailed score breakdowns
  overallScore: number; // Weighted average (0-100)
  passingScore: number; // Minimum required (typically 70-80)
  strengths?: string[]; // Positive feedback
  improvementAreas: string[]; // Specific, actionable feedback
  generatedAt: string; // ISO timestamp
  disclaimer: string; // Legal/fairness disclaimer
}

export interface ExplainableReceipt {
  hash: string; // SHA-256 of card + decision data
  card: ExplainableCard;
  signature: string; // HMAC for tamper detection
}

// ========================================
// Explainable Card Generator
// ========================================

export class ExplainableCardGenerator {
  private secretKey: string;

  constructor() {
    this.secretKey =
      process.env.EXPLAINABLE_SECRET_KEY ||
      "change-me-in-production-" + process.env.NODE_ENV;
  }

  /**
   * Generate Explainable Feedback Card from interview scores
   */
  generate(params: {
    decisionId: string;
    candidateEmail: string;
    jobTitle: string;
    rubric: RubricCriterion[];
    candidateScores: CandidateScore[];
    passingThreshold?: number;
    locale?: string;
  }): ExplainableCard {
    const {
      decisionId,
      candidateEmail,
      jobTitle,
      rubric,
      candidateScores,
      passingThreshold = 3.5, // Default: 3.5/5.0
      locale = "en-US",
    } = params;

    // Calculate rubric deltas
    const rubricDeltas = this.calculateDeltas(
      rubric,
      candidateScores,
      passingThreshold
    );

    // Calculate overall weighted score
    const overallScore = this.calculateOverallScore(rubricDeltas);
    const passingScore = (passingThreshold / 5.0) * 100;

    // Extract human-readable reasons
    const reasons = this.generateReasons(rubricDeltas);

    // Identify strengths and improvement areas
    const { strengths, improvementAreas } = this.categorizePerformance(
      rubricDeltas
    );

    // Get locale-specific disclaimer
    const disclaimer = this.getDisclaimer(locale);

    return {
      version: "1.0",
      decisionId,
      candidateEmail,
      jobTitle,
      locale,
      reasons,
      rubricDeltas,
      overallScore,
      passingScore,
      strengths: strengths.length > 0 ? strengths : undefined,
      improvementAreas,
      generatedAt: new Date().toISOString(),
      disclaimer,
    };
  }

  /**
   * Calculate deltas between candidate scores and thresholds
   */
  private calculateDeltas(
    rubric: RubricCriterion[],
    candidateScores: CandidateScore[],
    threshold: number
  ): RubricDelta[] {
    const deltas: RubricDelta[] = [];

    for (const criterion of rubric) {
      const candidateScore = candidateScores.find(
        (s) => s.criterion === criterion.name
      );

      if (!candidateScore) {
        // Missing score - treat as below threshold
        deltas.push({
          criterion: criterion.name,
          candidateScore: 0,
          threshold,
          delta: -threshold,
          weight: criterion.weight,
          isDeficient: true,
        });
        continue;
      }

      const delta = candidateScore.score - threshold;

      deltas.push({
        criterion: criterion.name,
        candidateScore: candidateScore.score,
        threshold,
        delta,
        weight: criterion.weight,
        evidence: candidateScore.evidence,
        isDeficient: delta < 0,
      });
    }

    // Sort by most deficient first
    return deltas.sort((a, b) => a.delta - b.delta);
  }

  /**
   * Calculate overall weighted score (0-100)
   */
  private calculateOverallScore(deltas: RubricDelta[]): number {
    let totalWeighted = 0;
    let totalWeight = 0;

    for (const delta of deltas) {
      totalWeighted += (delta.candidateScore / 5.0) * 100 * delta.weight;
      totalWeight += delta.weight;
    }

    return totalWeight > 0 ? totalWeighted / totalWeight : 0;
  }

  /**
   * Generate human-readable reasons from deltas
   */
  private generateReasons(deltas: RubricDelta[]): string[] {
    const reasons: string[] = [];

    // Top 3 deficiencies
    const deficiencies = deltas.filter((d) => d.isDeficient).slice(0, 3);

    for (const def of deficiencies) {
      const scorePct = ((def.candidateScore / 5.0) * 100).toFixed(0);
      reasons.push(
        `${def.criterion}: Scored ${scorePct}% (threshold: ${((def.threshold / 5.0) * 100).toFixed(0)}%)`
      );
    }

    // If no specific deficiencies, give general feedback
    if (reasons.length === 0) {
      reasons.push(
        "Other candidates demonstrated stronger alignment with our specific requirements for this role"
      );
    }

    return reasons;
  }

  /**
   * Categorize performance into strengths and improvement areas
   */
  private categorizePerformance(deltas: RubricDelta[]): {
    strengths: string[];
    improvementAreas: string[];
  } {
    const strengths: string[] = [];
    const improvementAreas: string[] = [];

    for (const delta of deltas) {
      if (delta.delta >= 1.0) {
        // Strong performance
        strengths.push(
          `${delta.criterion}: Strong performance (${delta.candidateScore.toFixed(1)}/5.0)`
        );
      } else if (delta.delta >= 0) {
        // Met threshold
        strengths.push(
          `${delta.criterion}: Met expectations (${delta.candidateScore.toFixed(1)}/5.0)`
        );
      } else {
        // Below threshold
        const gap = Math.abs(delta.delta);
        improvementAreas.push(
          `${delta.criterion}: Develop this skill further (scored ${delta.candidateScore.toFixed(1)}/5.0, ${gap.toFixed(1)} points below threshold)`
        );
      }
    }

    return { strengths, improvementAreas };
  }

  /**
   * Get locale-specific disclaimer
   */
  private getDisclaimer(locale: string): string {
    const disclaimers: Record<string, string> = {
      "en-US":
        "This feedback is based solely on job-related evaluation criteria and rubric scores from structured interviews. Our process is designed to be fair, objective, and free from bias related to protected characteristics such as age, gender, race, religion, disability, or other factors unrelated to job qualifications.",
      "en-EU":
        "This assessment is based exclusively on objective, job-related criteria in compliance with GDPR and EU employment law. We do not process or consider protected personal data categories in our decision-making process.",
      "en-CA":
        "This evaluation is based on bona fide occupational requirements in compliance with Canadian Human Rights legislation. Feedback is provided on job-related criteria only and does not reflect any prohibited grounds of discrimination.",
      "es-ES":
        "Esta evaluación se basa únicamente en criterios objetivos relacionados con el puesto y cumple con la legislación de empleo de la UE y el RGPD.",
      "fr-FR":
        "Cette évaluation repose exclusivement sur des critères objectifs liés au poste et est conforme à la législation européenne sur l'emploi et au RGPD.",
      "de-DE":
        "Diese Bewertung basiert ausschließlich auf objektiven, stellenbezogenen Kriterien in Übereinstimmung mit der DSGVO und dem EU-Arbeitsrecht.",
    };

    return (
      disclaimers[locale] ||
      disclaimers["en-US"] ||
      "This feedback is based solely on job-related criteria."
    );
  }

  /**
   * Create cryptographic receipt for audit trail
   */
  createReceipt(
    card: ExplainableCard,
    decision: {
      letter: string;
      reasons: string[];
      templateVersion?: string;
    }
  ): ExplainableReceipt {
    // Create deterministic hash of decision data
    const hashInput = JSON.stringify({
      card,
      decision: {
        letter: decision.letter,
        reasons: decision.reasons,
        templateVersion: decision.templateVersion,
      },
    });

    const hash = crypto.createHash("sha256").update(hashInput).digest("hex");

    // Create HMAC signature for tamper detection
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(hash)
      .digest("hex");

    return {
      hash,
      card,
      signature,
    };
  }

  /**
   * Verify receipt signature
   */
  verifyReceipt(receipt: ExplainableReceipt): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", this.secretKey)
      .update(receipt.hash)
      .digest("hex");

    return (
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(receipt.signature)
      )
    );
  }
}

// ========================================
// Singleton Instance
// ========================================

export const explainableGenerator = new ExplainableCardGenerator();

/**
 * Helper: Generate XFC from interview notes
 */
export function generateExplainableCard(params: {
  decisionId: string;
  candidateEmail: string;
  jobTitle: string;
  rubric: RubricCriterion[];
  candidateScores: CandidateScore[];
  passingThreshold?: number;
  locale?: string;
}): ExplainableCard {
  return explainableGenerator.generate(params);
}

/**
 * Helper: Create receipt
 */
export function createExplainableReceipt(
  card: ExplainableCard,
  decision: {
    letter: string;
    reasons: string[];
    templateVersion?: string;
  }
): ExplainableReceipt {
  return explainableGenerator.createReceipt(card, decision);
}
