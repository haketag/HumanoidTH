import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canonicalPlanEvidence,
  createPlanOwnerToken,
  hashPlanOwnerToken,
  isValidPlanOwnerToken,
  PLAN_OWNER_COOKIE,
  planEvidenceSchema,
  planInputSchema,
  planSnapshot,
  validatePlanOrigin
} from "@/lib/living-lab-plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function applyOwnerCookie(response: NextResponse, token: string) {
  response.cookies.set(PLAN_OWNER_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/",
    maxAge: 60 * 60 * 24 * 180
  });
}

async function readJsonBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 24_576) return { tooLarge: true, body: null };
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 24_576) return { tooLarge: true, body: null };
  try { return { tooLarge: false, body: JSON.parse(text) as unknown }; }
  catch { return { tooLarge: false, body: null }; }
}

async function readOwnerToken() {
  const token = (await cookies()).get(PLAN_OWNER_COOKIE)?.value;
  return isValidPlanOwnerToken(token) ? token : undefined;
}

export async function GET() {
  const token = await readOwnerToken();
  if (!token) return NextResponse.json({ plans: [] });
  try {
    const plans = await prisma.livingLabPlan.findMany({
      where: { ownerTokenHash: hashPlanOwnerToken(token) },
      orderBy: { updatedAt: "desc" }, take: 20,
      include: { _count: { select: { revisions: true } }, revisions: { select: { feedback: true, createdAt: true }, orderBy: { createdAt: "asc" } } }
    });
    const safePlans = await Promise.all(plans.map(async (record) => {
      const { ownerTokenHash, _count, ...plan } = record;
      void ownerTokenHash;
      const parsedEvidence = z.array(planEvidenceSchema).safeParse(Array.isArray(plan.evidence) ? plan.evidence.map((item) => item && typeof item === "object" ? { id: (item as { id?: unknown }).id, type: (item as { type?: unknown }).type } : {}) : []);
      const available = parsedEvidence.success ? await canonicalPlanEvidence(parsedEvidence.data) : [];
      const availableIds = new Set(available.map((item) => `${item.type}:${item.id}`));
      const evidenceList = Array.isArray(plan.evidence) ? plan.evidence as Array<{ id?: string; type?: string }> : [];
      const staleEvidenceIds = evidenceList.filter((item) => typeof item.id === "string" && typeof item.type === "string" && !availableIds.has(`${item.type}:${item.id}`)).map((item) => item.id!);
      return { ...plan, staleEvidenceIds, revisionCount: _count.revisions };
    }));
    return NextResponse.json({ plans: safePlans });
  } catch {
    return NextResponse.json({ error: "บันทึกแผนในฐานข้อมูลไม่ได้ กรุณาตรวจการเชื่อมต่อ" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!validatePlanOrigin(request)) return NextResponse.json({ error: "คำขอมาจากแหล่งที่ไม่อนุญาต" }, { status: 403 });
  const body = await readJsonBody(request);
  if (body.tooLarge) return NextResponse.json({ error: "คำขอมีขนาดใหญ่เกินกำหนด" }, { status: 413 });
  const parsed = planInputSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลแผนไม่ครบหรือไม่ถูกต้อง" }, { status: 400 });
  try {
    const evidence = await canonicalPlanEvidence(parsed.data.evidence);
    if (!evidence.length) return NextResponse.json({ error: "หลักฐานไม่พร้อมใช้งานแล้ว กรุณาค้นใหม่ก่อนบันทึก" }, { status: 409 });
    const token = (await readOwnerToken()) || createPlanOwnerToken();
    const ownerTokenHash = hashPlanOwnerToken(token);
    if (await prisma.livingLabPlan.count({ where: { ownerTokenHash } }) >= 20) {
      return NextResponse.json({ error: "มีแผนครบ 20 รายการแล้ว ลบแผนเก่าก่อนสร้างรายการใหม่" }, { status: 409 });
    }
    const snapshot = planSnapshot(parsed.data, evidence);
    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.livingLabPlan.create({
        data: {
          ownerTokenHash, title: parsed.data.title, objective: parsed.data.objective, steps: parsed.data.steps,
          question: parsed.data.question, role: parsed.data.role, participantGroup: parsed.data.participantGroup,
          participantCount: parsed.data.participantCount, siteContext: parsed.data.siteContext,
          activityGoal: parsed.data.activityGoal, sessionLength: parsed.data.sessionLength,
          staffing: parsed.data.staffing, readinessNotes: parsed.data.readinessNotes, evidence,
          evidenceSnapshotAt: new Date()
        }
      });
      await tx.livingLabPlanRevision.create({ data: { planId: created.id, snapshot, feedback: parsed.data.feedback } });
      return created;
    });
    const response = NextResponse.json({ plan: { ...plan, revisionCount: 1 } }, { status: 201 });
    if (!(await readOwnerToken())) applyOwnerCookie(response, token);
    return response;
  } catch {
    return NextResponse.json({ error: "บันทึกแผนไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!validatePlanOrigin(request)) return NextResponse.json({ error: "คำขอมาจากแหล่งที่ไม่อนุญาต" }, { status: 403 });
  const requestBody = await readJsonBody(request);
  if (requestBody.tooLarge) return NextResponse.json({ error: "คำขอมีขนาดใหญ่เกินกำหนด" }, { status: 413 });
  const body = requestBody.body as { id?: unknown; plan?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const parsed = planInputSchema.safeParse(body?.plan);
  if (!id || id.length > 128 || !parsed.success) return NextResponse.json({ error: "ข้อมูลแผนไม่ครบหรือไม่ถูกต้อง" }, { status: 400 });
  const token = await readOwnerToken();
  if (!token) return NextResponse.json({ error: "ไม่พบสิทธิ์ของแผนนี้" }, { status: 404 });
  try {
    const ownerTokenHash = hashPlanOwnerToken(token);
    const ownedPlan = await prisma.livingLabPlan.findFirst({ where: { id, ownerTokenHash }, select: { id: true } });
    if (!ownedPlan) return NextResponse.json({ error: "ไม่พบแผนนี้หรือคุณไม่มีสิทธิ์แก้ไข" }, { status: 404 });
    if (await prisma.livingLabPlanRevision.count({ where: { planId: id } }) >= 100) {
      return NextResponse.json({ error: "แผนนี้มีครบ 100 revision แล้ว" }, { status: 409 });
    }
    const evidence = await canonicalPlanEvidence(parsed.data.evidence);
    if (!evidence.length) return NextResponse.json({ error: "หลักฐานไม่พร้อมใช้งานแล้ว กรุณาค้นใหม่ก่อนบันทึก" }, { status: 409 });
    const snapshot = planSnapshot(parsed.data, evidence);
    const updated = await prisma.$transaction(async (tx) => {
      const plan = await tx.livingLabPlan.update({
        where: { id, ownerTokenHash },
        data: {
          title: parsed.data.title, objective: parsed.data.objective, steps: parsed.data.steps,
          question: parsed.data.question, role: parsed.data.role, participantGroup: parsed.data.participantGroup,
          participantCount: parsed.data.participantCount, siteContext: parsed.data.siteContext,
          activityGoal: parsed.data.activityGoal, sessionLength: parsed.data.sessionLength,
          staffing: parsed.data.staffing, readinessNotes: parsed.data.readinessNotes, evidence,
          evidenceSnapshotAt: new Date()
        }
      });
      await tx.livingLabPlanRevision.create({ data: { planId: id, snapshot, feedback: parsed.data.feedback } });
      const revisionCount = await tx.livingLabPlanRevision.count({ where: { planId: id } });
      return { ...plan, revisionCount };
    });
    return NextResponse.json({ plan: updated });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return NextResponse.json({ error: "ไม่พบแผนนี้หรือคุณไม่มีสิทธิ์แก้ไข" }, { status: 404 });
    return NextResponse.json({ error: "บันทึกการแก้ไขไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!validatePlanOrigin(request)) return NextResponse.json({ error: "คำขอมาจากแหล่งที่ไม่อนุญาต" }, { status: 403 });
  const requestBody = await readJsonBody(request);
  if (requestBody.tooLarge) return NextResponse.json({ error: "คำขอมีขนาดใหญ่เกินกำหนด" }, { status: 413 });
  const body = requestBody.body as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const token = await readOwnerToken();
  if (!id || id.length > 128 || !token) return NextResponse.json({ error: "ไม่พบแผนนี้หรือคุณไม่มีสิทธิ์ลบ" }, { status: 404 });
  try {
    const removed = await prisma.livingLabPlan.deleteMany({ where: { id, ownerTokenHash: hashPlanOwnerToken(token) } });
    return removed.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "ไม่พบแผนนี้หรือคุณไม่มีสิทธิ์ลบ" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "ลบแผนไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 503 });
  }
}
