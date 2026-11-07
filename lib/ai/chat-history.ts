import { safeSourceUrl, type Evidence, type ResearchResponse } from "../research-assistant";
import { isExpertRole, type ExpertRole } from "./expert-roles";

export type StoredConversationTurn = {
  id: string;
  question: string;
  answer: string;
  expertRole: ExpertRole;
  response: ResearchResponse;
};

export type StoredConversation = {
  id: string;
  title: string;
  expertRole: ExpertRole;
  robotId: string;
  robotName: string;
  messages: StoredConversationTurn[];
  createdAt: string;
  updatedAt: string;
};

const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES = 8;
const MAX_EVIDENCE = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readEvidence(value: unknown): Evidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Evidence => isRecord(item)
    && typeof item.id === "string"
    && typeof item.title === "string"
    && typeof item.excerpt === "string"
    && typeof item.citation === "number"
    && typeof item.status === "string"
    && ["source", "robot", "contribution", "perspective", "inventory", "organization"].includes(String(item.type)))
    .slice(0, MAX_EVIDENCE)
    .map((item) => ({ ...item, excerpt: item.excerpt.slice(0, 900), url: safeSourceUrl(item.url), documentUrl: safeSourceUrl(item.documentUrl) }));
}

function readResponse(value: unknown): ResearchResponse | null {
  if (!isRecord(value) || typeof value.answer !== "string") return null;
  const mode = ["extractive", "gemini", "web", "no_results"].includes(String(value.mode)) ? value.mode as ResearchResponse["mode"] : "extractive";
  const role = ["student", "researcher", "company", "general"].includes(String(value.role)) ? value.role as ResearchResponse["role"] : "general";
  return {
    answer: value.answer.slice(0, 6000),
    evidence: readEvidence(value.evidence),
    mode,
    role,
    researchProvider: value.researchProvider === "public" || value.researchProvider === "google" ? value.researchProvider : undefined,
    retrievedAt: typeof value.retrievedAt === "string" ? value.retrievedAt.slice(0, 40) : undefined,
    evidenceChecks: isRecord(value.evidenceChecks) ? { citationIdsValid: value.evidenceChecks.citationIdsValid === true, quotesMatched: value.evidenceChecks.quotesMatched === true, independentlyVerified: false } : undefined,
    limitations: Array.isArray(value.limitations) ? value.limitations.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
    unknowns: Array.isArray(value.unknowns) ? value.unknowns.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
    confidence: ["HIGH", "MEDIUM", "LOW"].includes(String(value.confidence)) ? value.confidence as ResearchResponse["confidence"] : undefined,
    confidenceReason: typeof value.confidenceReason === "string" ? value.confidenceReason.slice(0, 400) : undefined,
    intent: typeof value.intent === "string" ? value.intent.slice(0, 40) : undefined,
    robotContext: isRecord(value.robotContext) && typeof value.robotContext.id === "string" && typeof value.robotContext.name === "string"
      ? { id: value.robotContext.id, name: value.robotContext.name.slice(0, 200) }
      : undefined,
    externalSearchStatus: ["not_needed", "not_configured", "not_consented", "unavailable", "used"].includes(String(value.externalSearchStatus)) ? value.externalSearchStatus as ResearchResponse["externalSearchStatus"] : undefined,
    externalSources: Array.isArray(value.externalSources) ? value.externalSources.flatMap((item) => isRecord(item) && typeof item.title === "string" && typeof item.citation === "number" && typeof item.url === "string" && safeSourceUrl(item.url)
      ? [{ citation: item.citation, title: item.title.slice(0, 240), url: safeSourceUrl(item.url)!, contentLevel: ["intro", "abstract", "metadata", "internal"].includes(String(item.contentLevel)) ? item.contentLevel as "intro" | "abstract" | "metadata" | "internal" : undefined, sourceKind: ["official", "academic", "external"].includes(String(item.sourceKind)) ? item.sourceKind as "official" | "academic" | "external" : "external" }]
      : []).slice(0, 8) : [],
    documentReads: Array.isArray(value.documentReads) ? value.documentReads.flatMap((item) => isRecord(item) && typeof item.url === "string" && safeSourceUrl(item.url) && typeof item.status === "string" ? [{ url: safeSourceUrl(item.url)!, status: item.status.slice(0, 80) }] : []).slice(0, 8) : [],
    externalSearchQueries: Array.isArray(value.externalSearchQueries) ? value.externalSearchQueries.filter((item): item is string => typeof item === "string").slice(0, 8).map((item) => item.slice(0, 200)) : [],
    aiStatus: ["not_configured", "not_consented", "complete", "unavailable", "rate_limited"].includes(String(value.aiStatus)) ? value.aiStatus as ResearchResponse["aiStatus"] : undefined
  };
}

export function parseChatHistory(raw: string | null): StoredConversation[] {
  try {
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => isRecord(item)
      && typeof item.id === "string"
      && typeof item.title === "string"
      && isExpertRole(item.expertRole)
      && Array.isArray(item.messages))
      .slice(0, MAX_CONVERSATIONS)
      .map((item) => {
        const messages = (item.messages as unknown[]).filter((turn): turn is Record<string, unknown> => isRecord(turn)
          && typeof turn.id === "string"
          && typeof turn.question === "string"
          && typeof turn.answer === "string"
          && isExpertRole(turn.expertRole))
          .slice(-MAX_MESSAGES)
          .flatMap((turn) => {
            const response = readResponse(turn.response);
            return response ? [{ id: turn.id as string, question: (turn.question as string).slice(0, 500), answer: response.answer, expertRole: turn.expertRole as ExpertRole, response }] : [];
          });
        return {
          id: item.id as string,
          title: (item.title as string).slice(0, 80),
          expertRole: item.expertRole as ExpertRole,
          robotId: typeof item.robotId === "string" ? item.robotId.slice(0, 128) : "",
          robotName: typeof item.robotName === "string" ? item.robotName.slice(0, 200) : "",
          messages,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : ""
        };
      })
      .filter((chat) => chat.messages.length > 0);
  } catch { return []; }
}

export function serializeChatHistory(chats: StoredConversation[]) {
  return JSON.stringify(chats.slice(0, MAX_CONVERSATIONS).map((chat) => ({
    ...chat,
    title: chat.title.slice(0, 80),
    messages: chat.messages.slice(-MAX_MESSAGES).map((turn) => ({
      ...turn,
      question: turn.question.slice(0, 500),
      answer: turn.answer.slice(0, 6000),
      response: { ...turn.response, answer: turn.response.answer.slice(0, 6000), evidence: readEvidence(turn.response.evidence) }
    }))
  })));
}
