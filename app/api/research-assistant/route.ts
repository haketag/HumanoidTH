import { randomUUID } from "node:crypto";
import { ResearchError, researchErrorResponse } from "@/lib/ai/research-errors";
import { validatePlanOrigin } from "@/lib/living-lab-plans";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { allowResearchRequest, clientRateLimitKey } from "@/lib/gemini-rate-limit";
import { rankEvidence, safeSourceUrl, searchTerms, type Evidence } from "@/lib/research-assistant";
import { buildResearchContext, classifyResearchIntent, detectQuestionLanguage, isComparisonQuestion } from "@/lib/ai/intent";
import { isInventoryQuestion, isPerspectiveQuestion, robotEvidenceExcerpt, robotFacts } from "@/lib/ai/robot-context";
import { classifySourceKind } from "@/lib/ai/sources";
import { searchWithGoogleGrounding } from "@/lib/ai/web-search";
import { EXPERT_ROLE_IDS } from "@/lib/ai/expert-roles";

export const dynamic = "force-dynamic";

let companyDirectoryAvailable: boolean | undefined;

async function hasCompanyDirectory() {
  if (companyDirectoryAvailable !== undefined) return companyDirectoryAvailable;
  try {
    const rows = await prisma.$queryRaw<Array<{ available: boolean }>>`SELECT to_regclass('public."Company"') IS NOT NULL AS available`;
    companyDirectoryAvailable = rows[0]?.available === true;
  } catch {
    companyDirectoryAvailable = false;
  }
  return companyDirectoryAvailable;
}

const requestSchema = z.object({
  question: z.string().trim().min(3).max(500),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(800) })).max(6).default([]),
  robotId: z.string().trim().min(1).max(128).optional(),
  role: z.enum(["student", "researcher", "company", "general"]).default("general"),
  expertRole: z.enum(EXPERT_ROLE_IDS).default("hri_wellness_specialist"),
  language: z.enum(["th", "en"]).default("th"),
  allowGemini: z.boolean().default(false),
  adultConfirmed: z.boolean().default(false)
});

async function readJsonBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 8_192) return { tooLarge: true, body: null };
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 8_192) return { tooLarge: true, body: null };
  try { return { tooLarge: false, body: JSON.parse(text) as unknown }; }
  catch { return { tooLarge: false, body: null }; }
}

export async function POST(request: Request) {
  if (!validatePlanOrigin(request)) return NextResponse.json({ error: "คำขอมาจากแหล่งที่ไม่อนุญาต", code: "INVALID_ORIGIN" }, { status: 403 });
  const body = await readJsonBody(request);
  if (body.tooLarge) return NextResponse.json({ error: "คำขอมีขนาดใหญ่เกินกำหนด" }, { status: 413 });
  const parsed = requestSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: "กรุณาระบุคำถาม 3–500 ตัวอักษร" }, { status: 400 });
  const language = detectQuestionLanguage(parsed.data.question, parsed.data.language);

  const requestId = randomUUID();
  if (!process.env.GEMINI_API_KEY?.trim() || !process.env.GEMINI_MODEL?.trim()) return NextResponse.json({ error: language === "th" ? "บริการ AI ยังไม่ได้ตั้งค่า" : "AI research is not configured.", code: "AI_NOT_CONFIGURED", requestId }, { status: 503 });
  if (!parsed.data.allowGemini || !parsed.data.adultConfirmed) return NextResponse.json({ error: language === "th" ? "กรุณายินยอมให้ AI ค้นคว้าก่อนส่งคำถาม" : "Please enable consent for AI research.", code: "CONSENT_REQUIRED", requestId }, { status: 403 });
  try {
    if (!await allowResearchRequest(clientRateLimitKey(request))) return NextResponse.json({ error: language === "th" ? "ส่งคำถามถี่เกินไป กรุณารอสักครู่" : "Too many requests. Please wait.", code: "RATE_LIMITED", requestId }, { status: 429, headers: { "Retry-After": "60" } });
    let databaseUnavailable = false;
    const contextRobot = parsed.data.robotId ? await prisma.robotModel.findUnique({
      where: { id: parsed.data.robotId },
      select: { id: true, canonicalName: true, manufacturer: true, developerOrg: true, countryOfOrigin: true, robotType: true, primaryUseCase: true, thailandStatus: true, officialUrl: true, description: true, sourceMeta: true }
    }).catch(() => { databaseUnavailable = true; return null; }) : null;
    if (parsed.data.robotId && !contextRobot && !databaseUnavailable) return NextResponse.json({ error: "ไม่พบหุ่นยนต์ที่เลือก กรุณาเลือกจากคลังหุ่นยนต์อีกครั้ง" }, { status: 404 });
    const { retrievalQuestion } = buildResearchContext(parsed.data.question, parsed.data.history, contextRobot?.canonicalName);
    const terms = searchTerms(retrievalQuestion);
    const questionIntent = classifyResearchIntent(parsed.data.question, Boolean(contextRobot));
    const intent = questionIntent === "general" ? classifyResearchIntent(retrievalQuestion, Boolean(contextRobot)) : questionIntent;
    const containsAny = (field: string) => terms.map((term) => ({ [field]: { contains: term, mode: "insensitive" as const } }));
    const [sources, robots, contributions, perspectives, inventoryRows, companies] = await Promise.all([
      prisma.sourceRecord.findMany({
        where: { relevanceStatus: "ACCEPTED", OR: [...containsAny("title"), ...containsAny("excerpt")] },
        select: { id: true, title: true, excerpt: true, url: true, rawMeta: true, relevanceStatus: true },
        take: 30,
        orderBy: { updatedAt: "desc" }
      }),
      prisma.robotModel.findMany({
        where: { OR: [...(contextRobot ? [{ id: contextRobot.id }] : []), ...containsAny("canonicalName"), ...containsAny("description"), ...containsAny("manufacturer"), ...containsAny("developerOrg"), ...(intent === "catalog" ? [{ canonicalName: { not: "" } }] : [])] },
        select: { id: true, canonicalName: true, description: true, officialUrl: true, manufacturer: true, developerOrg: true, countryOfOrigin: true, robotType: true, primaryUseCase: true, thailandStatus: true, sourceMeta: true },
        take: 30,
        orderBy: { updatedAt: "desc" }
      }),
      prisma.contribution.findMany({
        where: {
          visibility: "public",
          verificationStatus: "APPROVED",
          OR: [...containsAny("title"), ...containsAny("description"), ...containsAny("organization"), ...containsAny("contributorName")]
        },
        select: { id: true, title: true, description: true, sourceUrl: true, verificationStatus: true },
        take: 30,
        orderBy: { updatedAt: "desc" }
      }),
      isPerspectiveQuestion(parsed.data.question) ? prisma.perspectiveAnnotation.findMany({
        where: { source: { is: { relevanceStatus: "ACCEPTED" } }, OR: [...containsAny("perspectiveTheme"), ...containsAny("targetEntity"), ...containsAny("evidenceExcerpt")] },
        select: { id: true, stance: true, sentiment: true, perspectiveTheme: true, targetEntity: true, evidenceExcerpt: true, source: { select: { title: true, url: true } } },
        take: 20,
        orderBy: { createdAt: "desc" }
      }) : Promise.resolve([]),
      isInventoryQuestion(parsed.data.question) ? prisma.ownedInventory.findMany({
        where: { visibility: "public" },
        select: { id: true, displayName: true, ownershipStatus: true, robotModel: { select: { id: true, canonicalName: true, manufacturer: true, officialUrl: true } } },
        take: 100,
        orderBy: { updatedAt: "desc" }
      }) : Promise.resolve([]),
      terms.length ? hasCompanyDirectory().then((available) => {
        if (!available) return [];
        return prisma.company.findMany({
          where: { OR: [...containsAny("name"), ...containsAny("domain"), ...containsAny("website")] },
          select: { id: true, name: true, website: true, domain: true, published: true },
          take: 20,
          orderBy: { name: "asc" }
        });
      }) : Promise.resolve([])
    ]).catch(() => { databaseUnavailable = true; return [[], [], [], [], [], []] as [never[], never[], never[], never[], never[], never[]]; });

    const candidates: Evidence[] = [
      ...sources.map((item) => {
        const rawMeta = item.rawMeta && typeof item.rawMeta === "object" && !Array.isArray(item.rawMeta) ? item.rawMeta as Record<string, unknown> : {};
        const documentUrl = safeSourceUrl(typeof rawMeta.openAccessPdfUrl === "string" ? rawMeta.openAccessPdfUrl : undefined)
          || safeSourceUrl(typeof rawMeta.openAccessLandingUrl === "string" ? rawMeta.openAccessLandingUrl : undefined);
        return { id: item.id, type: "source" as const, title: item.title, excerpt: item.excerpt.slice(0, 1200), url: safeSourceUrl(item.url), documentUrl, status: item.relevanceStatus };
      }),
      ...robots.map((item) => {
        const facts = robotFacts(item);
        return { id: item.id, type: "robot" as const, title: item.canonicalName, excerpt: robotEvidenceExcerpt(item, facts), facts, url: safeSourceUrl(item.officialUrl), status: "Registry record; manufacturer claims are not independently validated" };
      }),
      ...contributions.map((item) => ({ id: item.id, type: "contribution" as const, title: item.title, excerpt: (item.description || "").slice(0, 1200), url: safeSourceUrl(item.sourceUrl), status: item.verificationStatus })),
      ...perspectives.map((item) => ({ id: item.id, type: "perspective" as const, title: item.source.title, excerpt: `Derived perspective annotation (${item.perspectiveTheme}; ${item.stance}; ${item.sentiment}) for ${item.targetEntity}. ${item.evidenceExcerpt}`.slice(0, 1200), url: safeSourceUrl(item.source.url), status: "Derived annotation; linked source is ACCEPTED" })),
      ...inventoryRows.filter((item) => terms.some((term) => `${item.displayName} ${item.ownershipStatus} ${item.robotModel?.canonicalName || ""}`.toLocaleLowerCase().includes(term))).map((item) => ({ id: item.id, type: "inventory" as const, title: item.displayName, excerpt: `Public-safe inventory status: ${item.ownershipStatus}${item.robotModel?.canonicalName ? `; model: ${item.robotModel.canonicalName}` : ""}`, url: safeSourceUrl(item.robotModel?.officialUrl), status: "Public inventory record" })),
      ...companies.map((item) => {
        const published = item.published && typeof item.published === "object" && !Array.isArray(item.published) ? item.published as Record<string, unknown> : {};
        const description = [published.description, published.overview].filter((value): value is string => typeof value === "string").join(" ").slice(0, 1000);
        return { id: item.id, type: "organization" as const, title: item.name, excerpt: [item.domain, description].filter(Boolean).join(" · "), url: safeSourceUrl(item.website), status: "Public company directory record; profile claims are not independent verification" };
      })
    ].map((item) => ({ ...item, citation: 0 }));
    const ranked = rankEvidence(candidates, retrievalQuestion, parsed.data.expertRole === "robotics_engineer" ? ["robot"] : parsed.data.expertRole === "research_scientist" ? ["source"] : ["contribution", "perspective"]);
    const comparisonRobots = isComparisonQuestion(parsed.data.question) ? ranked.filter((item) => item.type === "robot").slice(0, 4) : [];
    const chosen = [...comparisonRobots, ...ranked.filter((item) => !comparisonRobots.some((robot) => robot.id === item.id))].slice(0, intent === "catalog" ? 30 : 8);
    const evidence = chosen.map((item, index) => ({ ...item, citation: index + 1 }));

    const sourceUrls = [...new Set([
      ...(retrievalQuestion.match(/https?:\/\/[^\s<>"']+/giu) || []).map((url) => url.replace(/[),.;!?]+$/u, "")),
      ...evidence.filter((item) => item.type === "source" || item.type === "contribution").flatMap((item) => [item.documentUrl, item.url])
    ].filter((url): url is string => Boolean(url)))].slice(0, 8);
    const research = await searchWithGoogleGrounding({
      question: [contextRobot?.canonicalName, parsed.data.question].filter(Boolean).join(" — "), role: parsed.data.role,
      expertRole: parsed.data.expertRole, language, evidence, citationOffset: evidence.length, sourceUrls, conversation: parsed.data.history
    });
    if (!research) throw new ResearchError("NO_SOURCES", "research");
    return NextResponse.json({
      answer: research.answer, evidence: evidence.filter((item) => research.answer.includes(`[${item.citation}]`)),
      externalSources: research.sources.map((source) => ({ ...source, sourceKind: classifySourceKind(source.url) })),
      documentReads: research.urlReads, externalSearchQueries: research.searchQueries,
      mode: "web", role: parsed.data.role, intent, externalSearchStatus: "used", aiStatus: "complete",
      researchProvider: research.provider, retrievedAt: research.retrievedAt, evidenceChecks: research.evidenceChecks,
      citationEvidence: research.citationEvidence, limitations: [], unknowns: [],
      ...(contextRobot ? { robotContext: { id: contextRobot.id, name: contextRobot.canonicalName } } : {}), requestId
    });
  } catch (error) {
    const issue = error instanceof ResearchError ? error : new ResearchError("INTERNAL_ERROR", "request");
    console.warn("[Pet AI] research failed", { requestId, code: issue.code, stage: issue.stage, upstreamStatus: issue.upstreamStatus });
    const response = researchErrorResponse(issue, language);
    return NextResponse.json({ error: response.error, code: issue.code, requestId }, { status: response.status });
  }
}
