import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { researchFeedbackSchema } from "@/lib/ai/feedback";
import { validatePlanOrigin } from "@/lib/living-lab-plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validatePlanOrigin(request)) return NextResponse.json({ error: "คำขอมาจากแหล่งที่ไม่อนุญาต" }, { status: 403 });
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 2_048) return NextResponse.json({ error: "คำขอมีขนาดใหญ่เกินกำหนด" }, { status: 413 });
  let body: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 2_048) return NextResponse.json({ error: "คำขอมีขนาดใหญ่เกินกำหนด" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "ข้อมูล feedback ไม่ถูกต้อง" }, { status: 400 });
  }
  const parsed = researchFeedbackSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูล feedback ไม่ถูกต้อง" }, { status: 400 });
  try {
    await prisma.researchAssistantFeedback.create({
      data: { ...parsed.data, issueCategory: parsed.data.issueCategory || null, comment: parsed.data.comment || null }
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "บันทึก feedback ไม่สำเร็จ" }, { status: 503 });
  }
}
