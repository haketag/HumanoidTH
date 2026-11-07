import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeSourceUrl, type Evidence } from "@/lib/research-assistant";

export const PLAN_OWNER_COOKIE = "living_lab_owner";
export const planEvidenceSchema = z.object({ id: z.string().min(1).max(128), type: z.enum(["source", "robot", "contribution", "perspective", "inventory", "organization"]) });

export const planInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  objective: z.string().max(1500).default(""),
  steps: z.string().max(6000).default(""),
  question: z.string().trim().min(3).max(500),
  role: z.enum(["student", "researcher", "company", "general"]).default("general"),
  participantGroup: z.string().max(160).default(""),
  participantCount: z.string().max(40).default(""),
  siteContext: z.string().max(240).default(""),
  activityGoal: z.string().max(240).default(""),
  sessionLength: z.string().max(80).default(""),
  staffing: z.string().max(160).default(""),
  readinessNotes: z.string().max(1200).default(""),
  evidence: z.array(planEvidenceSchema).min(1).max(12),
  feedback: z.string().trim().max(1000).default("")
});

export type PlanInput = z.infer<typeof planInputSchema>;

export function createPlanOwnerToken() { return randomBytes(32).toString("hex"); }
export function isValidPlanOwnerToken(token: string | undefined): token is string { return Boolean(token && /^[a-f0-9]{64}$/i.test(token)); }
export function hashPlanOwnerToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export function validatePlanOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function canonicalPlanEvidence(input: PlanInput["evidence"]): Promise<Evidence[]> {
  const sources = input.filter((item) => item.type === "source").map((item) => item.id);
  const robots = input.filter((item) => item.type === "robot").map((item) => item.id);
  const contributions = input.filter((item) => item.type === "contribution").map((item) => item.id);
  const perspectives = input.filter((item) => item.type === "perspective").map((item) => item.id);
  const inventories = input.filter((item) => item.type === "inventory").map((item) => item.id);
  const organizations = input.filter((item) => item.type === "organization").map((item) => item.id);
  const [sourceRecords, robotRecords, contributionRecords, perspectiveRecords, inventoryRecords, organizationRecords] = await Promise.all([
    sources.length ? prisma.sourceRecord.findMany({ where: { id: { in: sources }, relevanceStatus: "ACCEPTED" }, select: { id: true, title: true, excerpt: true, url: true, relevanceStatus: true } }) : [],
    robots.length ? prisma.robotModel.findMany({ where: { id: { in: robots } }, select: { id: true, canonicalName: true, description: true, officialUrl: true } }) : [],
    contributions.length ? prisma.contribution.findMany({ where: { id: { in: contributions }, visibility: "public", verificationStatus: "APPROVED" }, select: { id: true, title: true, description: true, sourceUrl: true, verificationStatus: true } }) : [],
    perspectives.length ? prisma.perspectiveAnnotation.findMany({ where: { id: { in: perspectives }, source: { is: { relevanceStatus: "ACCEPTED" } } }, select: { id: true, stance: true, sentiment: true, perspectiveTheme: true, targetEntity: true, evidenceExcerpt: true, source: { select: { title: true, url: true } } } }) : [],
    inventories.length ? prisma.ownedInventory.findMany({ where: { id: { in: inventories }, visibility: "public" }, select: { id: true, displayName: true, ownershipStatus: true, robotModel: { select: { canonicalName: true } } } }) : [],
    organizations.length ? prisma.company.findMany({ where: { id: { in: organizations } }, select: { id: true, name: true, website: true, published: true } }) : []
  ]);
  const sourceById = new Map(sourceRecords.map((item) => [item.id, item]));
  const robotById = new Map(robotRecords.map((item) => [item.id, item]));
  const contributionById = new Map(contributionRecords.map((item) => [item.id, item]));
  const perspectiveById = new Map(perspectiveRecords.map((item) => [item.id, item]));
  const inventoryById = new Map(inventoryRecords.map((item) => [item.id, item]));
  const organizationById = new Map(organizationRecords.filter((item) => item.published !== null).map((item) => [item.id, item]));
  const canonical: Omit<Evidence, "citation">[] = [];
  for (const requested of input) {
    if (requested.type === "source") {
      const item = sourceById.get(requested.id);
      if (item) canonical.push({ id: item.id, type: "source", title: item.title, excerpt: item.excerpt.slice(0, 1200), url: safeSourceUrl(item.url), status: item.relevanceStatus });
      continue;
    }
    if (requested.type === "robot") {
      const item = robotById.get(requested.id);
      if (item) canonical.push({ id: item.id, type: "robot", title: item.canonicalName, excerpt: (item.description || "").slice(0, 1200), url: safeSourceUrl(item.officialUrl), status: "Registry record" });
      continue;
    }
    if (requested.type === "contribution") {
      const item = contributionById.get(requested.id);
      if (item) canonical.push({ id: item.id, type: "contribution", title: item.title, excerpt: (item.description || "").slice(0, 1200), url: safeSourceUrl(item.sourceUrl), status: item.verificationStatus });
      continue;
    }
    if (requested.type === "perspective") {
      const item = perspectiveById.get(requested.id);
      if (item) canonical.push({ id: item.id, type: "perspective", title: item.source.title, excerpt: `Derived perspective annotation (${item.perspectiveTheme}; ${item.stance}; ${item.sentiment}) for ${item.targetEntity}. ${item.evidenceExcerpt}`.slice(0, 1200), url: safeSourceUrl(item.source.url), status: "Derived annotation; linked source is ACCEPTED" });
      continue;
    }
    if (requested.type === "inventory") {
      const item = inventoryById.get(requested.id);
      if (item) canonical.push({ id: item.id, type: "inventory", title: item.displayName, excerpt: `Public-safe inventory status: ${item.ownershipStatus}${item.robotModel?.canonicalName ? `; model: ${item.robotModel.canonicalName}` : ""}`, url: null, status: "Public inventory record" });
      continue;
    }
    const item = organizationById.get(requested.id);
    if (item) {
      const profile = item.published && typeof item.published === "object" && !Array.isArray(item.published) ? item.published as Record<string, unknown> : {};
      canonical.push({ id: item.id, type: "organization", title: item.name, excerpt: typeof profile.description === "string" ? profile.description.slice(0, 1200) : "Published organization profile", url: safeSourceUrl(item.website), status: "Published company profile" });
    }
  }
  return canonical.map((item, index) => ({ ...item, citation: index + 1 }));
}

export function planSnapshot(plan: PlanInput, evidence: Evidence[]) {
  return {
    title: plan.title, objective: plan.objective, steps: plan.steps, question: plan.question, role: plan.role,
    participantGroup: plan.participantGroup, participantCount: plan.participantCount, siteContext: plan.siteContext,
    activityGoal: plan.activityGoal, sessionLength: plan.sessionLength, staffing: plan.staffing,
    readinessNotes: plan.readinessNotes, evidence, evidenceSnapshotAt: new Date().toISOString()
  };
}
