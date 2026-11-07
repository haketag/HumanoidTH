import { searchTerms, type Evidence } from "../research-assistant";
import { questionNeedsFreshnessCheck, type ResearchIntent } from "./intent";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type ConfidenceAssessment = { level: ConfidenceLevel; reason: string; matchedConcepts: number; totalConcepts: number };

export function assessEvidenceConfidence(
  question: string,
  evidence: Evidence[],
  intent: ResearchIntent,
  contextRobotSelected = false
): ConfidenceAssessment {
  const terms = searchTerms(question);
  const haystack = evidence.map((item) => `${item.title} ${item.excerpt} ${Object.values(item.facts || {}).join(" ")}`).join(" ").toLocaleLowerCase();
  const matchedConcepts = terms.filter((term) => haystack.includes(term)).length;
  const totalConcepts = Math.max(terms.length, 1);
  const coverage = matchedConcepts / totalConcepts;
  const hasCitableSource = evidence.some((item) => Boolean(item.url) && (item.type === "source" || item.type === "robot" || item.type === "contribution"));
  const robotCount = new Set(evidence.filter((item) => item.type === "robot").map((item) => item.id)).size;
  const fresh = questionNeedsFreshnessCheck(question) || intent === "current_information";

  if (!evidence.length) return { level: "LOW", reason: "No matching public records were retrieved.", matchedConcepts, totalConcepts };
  if (intent === "catalog" && robotCount > 0) return { level: "MEDIUM", reason: "Robot registry entries were listed; the result reflects the records available in HumanoidTH, not an exhaustive external catalog.", matchedConcepts, totalConcepts };
  if (intent === "comparison" && robotCount < 2) return { level: "LOW", reason: "Fewer than two robot records matched the comparison request.", matchedConcepts, totalConcepts };
  if (intent === "recommendation" && !evidence.some((item) => item.facts && Object.keys(item.facts).length > 0)) {
    return { level: "LOW", reason: "The records do not contain structured capability evidence for a suitability recommendation.", matchedConcepts, totalConcepts };
  }
  if (fresh) return { level: "MEDIUM", reason: "The question asks for information that may change over time.", matchedConcepts, totalConcepts };
  if (intent === "research" && evidence.some((item) => item.type === "source")) {
    return { level: "MEDIUM", reason: "Research records contain abstracts or excerpts; the linked paper should be checked for full-text evidence.", matchedConcepts, totalConcepts };
  }
  if (coverage >= 0.7 && hasCitableSource) return { level: "HIGH", reason: "Retrieved records directly match the question and include a citable source.", matchedConcepts, totalConcepts };
  if (coverage >= 0.3) return { level: "MEDIUM", reason: "Some relevant records were found, but they may not cover every part of the question.", matchedConcepts, totalConcepts };
  if (contextRobotSelected && evidence.some((item) => item.type === "robot")) {
    return { level: "MEDIUM", reason: "A selected robot record is available, but supporting details are limited.", matchedConcepts, totalConcepts };
  }
  return { level: "LOW", reason: "The retrieved records provide little direct support for the question.", matchedConcepts, totalConcepts };
}

export function shouldSearchExternal(question: string, confidence: ConfidenceLevel, intent: ResearchIntent) {
  if (intent === "catalog") return false;
  return confidence !== "HIGH" || intent === "current_information" || questionNeedsFreshnessCheck(question);
}
