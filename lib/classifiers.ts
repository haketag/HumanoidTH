import { generateWithGemini } from "./gemini-client";

const robotTerms = [
  "robot",
  "robotics",
  "humanoid",
  "android robot",
  "social robot",
  "service robot",
  "companion robot",
  "dinsaw",
  "nao",
  "pepper robot",
  "hospital robot",
  "หุ่นยนต์",
  "embodied ai",
  "hri",
  "telepresence"
];

const thailandTerms = [
  "thailand",
  "thai",
  "bangkok",
  "chiang mai",
  "chulalongkorn",
  "mahidol",
  "ประเทศไทย",
  "ไทย",
  "กรุงเทพ"
];

const themeRules: Array<[string, string[]]> = [
  ["job_displacement", ["replace jobs", "job", "แรงงาน", "ตกงาน"]],
  ["healthcare_and_eldercare_trust", ["hospital", "elder", "care", "ผู้สูงอายุ", "โรงพยาบาล"]],
  ["education_and_learning", ["school", "student", "education", "university", "เรียน"]],
  ["privacy_and_surveillance", ["privacy", "surveillance", "camera", "ข้อมูลส่วนตัว"]],
  ["safety_and_reliability", ["safe", "reliability", "risk", "accident", "ปลอดภัย"]],
  ["national_innovation", ["innovation", "startup", "thai-made", "national", "นวัตกรรม"]],
  ["entertainment_and_novelty", ["festival", "expo", "demo", "cute", "show", "นิทรรศการ"]]
];

const positiveTerms = ["help", "benefit", "support", "innovation", "assist", "improve", "ช่วย", "ดี"];
const negativeTerms = ["risk", "replace", "concern", "privacy", "unsafe", "expensive", "กังวล", "แพง"];

function hasTopicTerm(text: string, term: string) {
  if (/[\u0E00-\u0E7F]/.test(term)) return text.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, "i").test(text);
}

export function classifyRelevance(title: string, excerpt = "") {
  const text = `${title} ${excerpt}`.toLowerCase();
  const robotHit = robotTerms.some((term) => hasTopicTerm(text, term));
  const thailandHit = thailandTerms.some((term) => hasTopicTerm(text, term));

  if (robotHit && thailandHit) {
    return {
      relevanceStatus: "ACCEPTED" as const,
      relevanceReason: "Robotics topic with a Thailand connection in the title or excerpt; verify both from the source.",
      relevanceConfidence: 0.62
    };
  }

  if (!robotHit) {
    return {
      relevanceStatus: "REJECTED" as const,
      relevanceReason: "No clear robotics evidence in the title or excerpt.",
      relevanceConfidence: 0.78
    };
  }

  return {
    relevanceStatus: "UNCERTAIN" as const,
    relevanceReason: "Robotics is mentioned, but a Thailand connection is not clear; needs human review.",
    relevanceConfidence: 0.35
  };
}

export function extractPerspective(title: string, excerpt = "") {
  const text = `${title} ${excerpt}`.toLowerCase();
  if (text.trim().length < 20) {
    return {
      stance: "unclear",
      sentiment: "unclear",
      perspectiveTheme: "unclear",
      targetEntity: "humanoid/social robotics",
      evidenceExcerpt: "",
      confidence: 0.2,
      method: "abstain_thin_evidence"
    };
  }

  const theme =
    themeRules.find(([, terms]) => terms.some((term) => text.includes(term)))?.[0] ?? "unclear";
  const negatedPositive = /(?:\b(?:not|never|cannot|can't)\s+(?:help|benefit|support|assist|improve)\b|(?:ไม่|ไม่ได้|มิได้|ไม่สามารถ)\s*(?:ช่วย|สนับสนุน|ปรับปรุง))/i.test(text);
  const positive = !negatedPositive && positiveTerms.some((term) => text.includes(term));
  const negative = negatedPositive || negativeTerms.some((term) => text.includes(term));

  return {
    stance: positive && negative ? "cautious_supportive" : positive ? "supportive" : negative ? "skeptical" : "neutral",
    sentiment: positive && negative ? "mixed" : positive ? "positive" : negative ? "negative" : "neutral",
    perspectiveTheme: theme,
    targetEntity: "humanoid/social robots in Thailand",
    evidenceExcerpt: (excerpt || title).slice(0, 280),
    confidence: theme === "unclear" ? 0.45 : 0.72,
    method: "rules_with_evidence"
  };
}

export async function classifyWithGemini(title: string, excerpt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  if (!model) {
    throw new Error("GEMINI_MODEL environment variable is not set.");
  }

  const prompt = `
You are an expert AI classifying research and media articles for the Thailand Humanoid Atlas.
Analyze the following article title and excerpt:

Title: "${title}"
Excerpt: "${excerpt}"

Please evaluate and classify this article. Set:
- 'isRelevant' to true if it refers to humanoid, service, companion, companion/eldercare, museum, education, or social robotics in Thailand or with a clear Thailand connection (e.g. Thai authors, Thai universities, Thai deployment). Otherwise false.
- 'relevanceReason': A brief sentence explaining why it is relevant or not.
- 'relevanceConfidence': Confidence score for relevance (float between 0.0 and 1.0).
- 'theme': Pick the most matching theme from this list:
    - "job_displacement" (fears of jobs being replaced)
    - "healthcare_and_eldercare_trust" (medical, elderly care, hospital use)
    - "education_and_learning" (schools, universities, teaching)
    - "privacy_and_surveillance" (cameras, tracking, personal data concerns)
    - "safety_and_reliability" (accidents, safety guarantees, reliability)
    - "national_innovation" (Thai-made robots, startup innovation, national policies)
    - "entertainment_and_novelty" (expo shows, festivals, cute robots, public events)
    - "unclear" (none of the above apply)
- 'stance': Stance towards the robotics development (supportive, skeptical, neutral, cautious_supportive, unclear).
- 'sentiment': Emotional tone of the article (positive, negative, neutral, mixed, unclear).
- 'targetEntity': The specific robot name (e.g., NAO, Dinsaw, Pepper), university/lab, or general focus entity.
- 'evidenceExcerpt': A one-sentence key quote or excerpt from the title/text that supports the theme or stance. Keep it short.
- 'confidence': Overall classification confidence (float between 0.0 and 1.0).
- 'triplets': Extract any semantic relationships (triplets) mentioned in the text. Each triplet represents a relationship between entities. 
  Example: {"subject": "Chulalongkorn University", "relation": "developed", "object": "Dinsaw Robot", "confidence": 0.85}.
  Common relations: developed, deployed_in, collaborated_with, researched, studied, uses, funds, discusses.
  Keep entity names clean and canonical. Return an empty array if no clear relationships can be extracted.
`;

  const response = await generateWithGemini({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            isRelevant: { type: "BOOLEAN" },
            relevanceReason: { type: "STRING" },
            relevanceConfidence: { type: "NUMBER" },
            theme: { 
              type: "STRING", 
              enum: ["job_displacement", "healthcare_and_eldercare_trust", "education_and_learning", "privacy_and_surveillance", "safety_and_reliability", "national_innovation", "entertainment_and_novelty", "unclear"]
            },
            stance: {
              type: "STRING",
              enum: ["supportive", "skeptical", "neutral", "cautious_supportive", "unclear"]
            },
            sentiment: {
              type: "STRING",
              enum: ["positive", "negative", "neutral", "mixed", "unclear"]
            },
            targetEntity: { type: "STRING" },
            evidenceExcerpt: { type: "STRING" },
            confidence: { type: "NUMBER" },
            triplets: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  subject: { type: "STRING" },
                  relation: { type: "STRING" },
                  object: { type: "STRING" },
                  confidence: { type: "NUMBER" }
                },
                required: ["subject", "relation", "object", "confidence"]
              }
            }
          },
          required: ["isRelevant", "relevanceReason", "relevanceConfidence", "theme", "stance", "sentiment", "targetEntity", "evidenceExcerpt", "confidence", "triplets"]
        }
      }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API returned error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error("Empty response from Gemini API");
  }

  return JSON.parse(textResponse) as {
    isRelevant: boolean;
    relevanceReason: string;
    relevanceConfidence: number;
    theme: string;
    stance: string;
    sentiment: string;
    targetEntity: string;
    evidenceExcerpt: string;
    confidence: number;
    triplets?: Array<{
      subject: string;
      relation: string;
      object: string;
      confidence: number;
    }>;
  };
}

