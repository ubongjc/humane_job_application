import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});

export interface GenerateLetterParams {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  reasons: string[];
  jurisdiction: "US" | "EU" | "CA";
  tone: "formal" | "friendly" | "empathetic";
  customTemplate?: string;
}

export interface LetterGenerationResult {
  letter: string;
  biasWarnings: string[];
  passed: boolean;
}

export async function generateRejectionLetter(
  params: GenerateLetterParams
): Promise<LetterGenerationResult> {
  const { candidateName, jobTitle, companyName, reasons, jurisdiction, tone, customTemplate } = params;

  // Build the prompt based on jurisdiction and tone
  const systemPrompt = buildSystemPrompt(jurisdiction, tone);
  const userPrompt = buildUserPrompt(candidateName, jobTitle, companyName, reasons, customTemplate);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const generatedLetter = completion.choices[0]?.message?.content || "";

    // Run bias detection
    const biasCheckResult = await detectBias(generatedLetter, reasons);

    return {
      letter: generatedLetter,
      biasWarnings: biasCheckResult.warnings,
      passed: biasCheckResult.passed,
    };
  } catch (error) {
    console.error("Error generating letter:", error);
    throw new Error("Failed to generate rejection letter");
  }
}

function buildSystemPrompt(jurisdiction: string, tone: string): string {
  const basePrompt = `You are an expert HR communication assistant specializing in writing humane, respectful candidate rejection letters.

Your letters must:
- Be empathetic and respectful
- Focus on constructive feedback
- Avoid discriminatory language
- NEVER mention protected characteristics (age, race, gender, disability, religion, etc.)
- NEVER infer or mention medical conditions
- Keep feedback professional and actionable
- Maintain candidate dignity and brand reputation`;

  const jurisdictionGuidelines: Record<string, string> = {
    US: `
US-specific guidelines:
- Comply with EEOC regulations
- Avoid any language related to protected classes
- Keep feedback business-focused and objective
- Do not make promises about future opportunities unless explicitly requested`,

    EU: `
EU-specific guidelines (GDPR compliant):
- Comply with EU employment law and GDPR
- Candidates have right to explanation under GDPR Article 22
- Provide specific, factual feedback tied to job requirements
- Avoid automated decision-making language
- Mention data retention policies if applicable`,

    CA: `
Canada-specific guidelines:
- Comply with Canadian Human Rights Act
- Follow provincial employment standards
- Provide constructive, specific feedback
- Avoid discrimination based on protected grounds
- Be transparent about decision criteria`,
  };

  const toneGuidelines: Record<string, string> = {
    formal: "Use professional, formal language. Maintain appropriate distance while being respectful.",
    friendly: "Use warm, approachable language. Balance professionalism with genuine kindness.",
    empathetic: "Lead with empathy and understanding. Acknowledge the emotional aspect of rejection while being professional.",
  };

  return `${basePrompt}

${jurisdictionGuidelines[jurisdiction] || jurisdictionGuidelines.US}

Tone: ${toneGuidelines[tone] || toneGuidelines.formal}`;
}

function buildUserPrompt(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  reasons: string[],
  customTemplate?: string
): string {
  if (customTemplate) {
    return `Use this template as a guide, filling in the variables with the provided information:

Template: ${customTemplate}

Variables:
- Candidate Name: ${candidateName}
- Job Title: ${jobTitle}
- Company Name: ${companyName}
- Feedback Points: ${reasons.join(", ")}

Generate a complete rejection letter.`;
  }

  return `Generate a candidate rejection letter with the following details:

Candidate Name: ${candidateName}
Job Title: ${jobTitle}
Company Name: ${companyName}

Specific feedback areas (keep constructive and professional):
${reasons.map((r, i) => `${i + 1}. ${r}`).join("\n")}

The letter should:
1. Thank them for their interest and time
2. Deliver the rejection clearly but kindly
3. Provide the specific feedback points above in a constructive way
4. Wish them well in their job search
5. Be 200-300 words

Generate the letter now:`;
}

interface BiasCheckResult {
  passed: boolean;
  warnings: string[];
}

async function detectBias(
  letter: string,
  reasons: string[]
): Promise<BiasCheckResult> {
  // Pattern-based bias detection
  const warnings: string[] = [];

  // Prohibited patterns that indicate bias
  const biasPatterns = [
    { pattern: /\b(old|young|age|elderly|senior|junior)\b/i, warning: "Age-related language detected" },
    { pattern: /\b(he|she|his|her|gender|male|female|man|woman)\b/i, warning: "Gender-specific language detected" },
    { pattern: /\b(race|ethnicity|color|national origin|accent)\b/i, warning: "Race/ethnicity language detected" },
    { pattern: /\b(disability|disabled|handicap|medical|health|condition|illness)\b/i, warning: "Medical/disability language detected" },
    { pattern: /\b(religion|religious|faith|belief|church|mosque|temple)\b/i, warning: "Religious language detected" },
    { pattern: /\b(pregnant|pregnancy|family|marital|married|single|children|kids)\b/i, warning: "Family status language detected" },
    { pattern: /\b(overqualified|too experienced)\b/i, warning: "Potential age discrimination (overqualified)" },
    { pattern: /\b(cultural fit|fit our culture)\b/i, warning: "Vague 'culture fit' may mask bias" },
  ];

  // Check letter content
  for (const { pattern, warning } of biasPatterns) {
    if (pattern.test(letter)) {
      warnings.push(warning);
    }
  }

  // Check reasons as well
  const reasonsText = reasons.join(" ");
  for (const { pattern, warning } of biasPatterns) {
    if (pattern.test(reasonsText)) {
      warnings.push(`In feedback: ${warning}`);
    }
  }

  // Use OpenAI for advanced bias detection
  if (warnings.length === 0) {
    try {
      const biasCheck = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a bias detection system. Analyze the following rejection letter for any subtle discrimination, bias, or inappropriate content related to protected characteristics (age, race, gender, disability, religion, national origin, etc.).

Respond ONLY with "PASS" if the letter is bias-free, or "FAIL: [specific issue]" if you detect any problems.`,
          },
          {
            role: "user",
            content: `Analyze this rejection letter:\n\n${letter}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      });

      const result = biasCheck.choices[0]?.message?.content || "";

      if (result.startsWith("FAIL")) {
        warnings.push(result.replace("FAIL:", "").trim());
      }
    } catch (error) {
      console.error("Error in AI bias detection:", error);
      // Continue with pattern-based detection only
    }
  }

  return {
    passed: warnings.length === 0,
    warnings,
  };
}

export async function generateFeedbackSuggestions(
  jobRubric: Record<string, any>,
  candidateScores: Record<string, number>
): Promise<string[]> {
  const suggestions: string[] = [];

  // Generate constructive feedback based on rubric scores
  for (const [criterion, score] of Object.entries(candidateScores)) {
    if (score < 3) { // Assuming 1-5 scale
      const rubricInfo = jobRubric[criterion];

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are an expert at providing constructive, actionable feedback to job candidates. Generate a single sentence of professional feedback that is specific, actionable, and encouraging.",
            },
            {
              role: "user",
              content: `Generate constructive feedback for a candidate who scored ${score}/5 on "${criterion}". Context: ${JSON.stringify(rubricInfo)}. Keep it brief and actionable.`,
            },
          ],
          temperature: 0.8,
          max_tokens: 100,
        });

        const feedback = completion.choices[0]?.message?.content?.trim();
        if (feedback) {
          suggestions.push(feedback);
        }
      } catch (error) {
        console.error("Error generating feedback suggestion:", error);
      }
    }
  }

  return suggestions;
}
