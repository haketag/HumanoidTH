"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Evidence, ResearchResponse } from "@/lib/research-assistant";

type Role = "student" | "researcher" | "company" | "general";
type Plan = {
  id: string; title: string; objective: string; steps: string; question: string; role: Role;
  participantGroup: string; participantCount: string; siteContext: string; activityGoal: string;
  sessionLength: string; staffing: string; readinessNotes: string; evidence: Evidence[];
  evidenceSnapshotAt: string; updatedAt: string; revisionCount: number;
  staleEvidenceIds?: string[]; revisions: { feedback: string; createdAt: string }[];
};
type PlanForm = Omit<Plan, "id" | "evidenceSnapshotAt" | "updatedAt" | "revisionCount" | "revisions" | "staleEvidenceIds"> & { feedback: string };

const EMPTY_PLAN: PlanForm = {
  title: "", objective: "", steps: "", question: "", role: "general", participantGroup: "", participantCount: "",
  siteContext: "", activityGoal: "", sessionLength: "", staffing: "", readinessNotes: "", evidence: [], feedback: ""
};

function EvidenceCards({ items, th }: { items: Evidence[]; th: boolean }) {
  return <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 14 }}>
    {items.map((item) => <li id={`source-${item.citation}`} key={`${item.type}-${item.id}`} className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong>[{item.citation}] {item.title}</strong><small>{item.type} · {item.status} · {item.excerpt ? (th ? "มีข้อความบางส่วน" : "Excerpt available") : (th ? "มีเฉพาะข้อมูลกำกับ" : "Metadata only")}</small>
      </div>
      <p style={{ whiteSpace: "pre-wrap" }}>{item.excerpt || (th ? "รายการนี้ยังไม่มีบทคัดย่อหรือข้อความเนื้อหา จึงใช้ยืนยันผลการศึกษาไม่ได้" : "No abstract or text is available, so this record cannot support study outcome claims.")}</p>
      {item.url && <a href={item.url} target="_blank" rel="noreferrer">{th ? "เปิดแหล่งข้อมูล" : "Open source"}</a>}
    </li>)}
  </ol>;
}

function makePlan(form: PlanForm, th: boolean): PlanForm {
  const activity = form.activityGoal.trim();
  const participants = form.participantGroup.trim();
  const location = form.siteContext.trim();
  const evidenceList = form.evidence.map((item) => `[${item.citation}] ${item.title}`).join("\n");
  const objective = th
    ? `ตรวจความเป็นไปได้และประสบการณ์ใช้งานของกิจกรรม “${activity}” สำหรับ ${participants}${form.participantCount ? ` จำนวน ${form.participantCount} คน` : ""} ที่ ${location}${form.sessionLength ? ` ใช้เวลาประมาณ ${form.sessionLength}` : ""} ไม่ใช่การทดสอบประสิทธิผลทางคลินิกหรือการรักษา`
    : `Assess feasibility and user experience for “${activity}” with ${participants}${form.participantCount ? ` (${form.participantCount} participants)` : ""} at ${location}${form.sessionLength ? ` (about ${form.sessionLength})` : ""}. This is not a clinical efficacy or treatment evaluation.`;
  const steps = th ? [
    "1. ก่อนกิจกรรม: ชี้แจงวัตถุประสงค์ ขอความยินยอม ตรวจการเข้าถึง และตกลงวิธีหยุดหรือถอนตัวโดยไม่เสียสิทธิ์",
    `2. ตรวจความพร้อมสถานที่ อุปกรณ์ การเชื่อมต่อ และผู้ช่วยหน้างาน${form.staffing ? ` (ผู้ดูแล: ${form.staffing})` : ""} บันทึกเวลา setup และแผนสำรองเมื่อหุ่นหรือระบบขัดข้อง`,
    `3. ทดลองกิจกรรม “${activity}” ตามบทบาทที่ผู้เข้าร่วมเลือก ห้ามให้หุ่นสัมผัสหรือเคลื่อนที่ใกล้คนโดยไม่มีการควบคุมที่ตกลงไว้`,
    "4. สังเกตการเริ่ม/จบกิจกรรม การขอความช่วยเหลือ การขัดจังหวะ ความเข้าใจ และความสบายใจ โดยไม่อนุมานผลสุขภาพจากความชอบหรือการเข้าร่วม",
    "5. ปิดกิจกรรม: ตรวจความรู้สึกไม่สบาย เหตุการณ์ไม่คาดคิด และลบ/เก็บข้อมูลตามความยินยอมและนโยบายของสถานที่",
    `6. ทบทวนข้อจำกัดและหลักฐานก่อนใช้: ${evidenceList}`,
    "ข้อจำกัด: สถานะฐานข้อมูลไม่ใช่การตรวจสอบข้อเท็จจริงอย่างอิสระ เปิดงานต้นฉบับ ตรวจประชากร วิธีการ และผลลัพธ์ก่อนอ้างข้อค้นพบ"
  ].join("\n") : [
    "1. Before the session: explain the purpose, obtain consent, check accessibility, and agree on a stop or withdrawal process without penalty.",
    `2. Check the site, equipment, connectivity, and staff coverage${form.staffing ? ` (${form.staffing})` : ""}; record setup time and an alternate process if the robot or system fails.`,
    `3. Run “${activity}” within the participant-selected interaction boundaries. Do not allow unplanned contact or unsupervised movement near people.`,
    "4. Observe task start/completion, help requests, interruptions, comprehension, and comfort. Do not infer health outcomes from preference or participation.",
    "5. Close the session: check for discomfort or incidents and handle collected data according to consent and site policy.",
    `6. Review limits and sources before use:\n${evidenceList}`,
    "Limit: database workflow status is not independent verification. Open original studies and check population, methods, and outcomes before making claims."
  ].join("\n");
  return { ...form, title: (th ? `แผน Living Lab: ${activity}` : `Living Lab plan: ${activity}`).slice(0, 120), objective, steps };
}

export default function ResearchAssistantClient({ lang, geminiConfigured, initialQuestion = "", initialRobotId = "", initialRobotName = "" }: { lang: "en" | "th"; geminiConfigured: boolean; initialQuestion?: string; initialRobotId?: string; initialRobotName?: string }) {
  const th = lang === "th";
  const [question, setQuestion] = useState(initialQuestion);
  const [robotId, setRobotId] = useState(initialRobotId);
  const [robotName, setRobotName] = useState(initialRobotName);
  const [role, setRole] = useState<Role>("general");
  const [aiConsent, setAiConsent] = useState(false);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<PlanForm>(EMPTY_PLAN);
  const [draftId, setDraftId] = useState("");
  const [drafts, setDrafts] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [staleEvidenceIds, setStaleEvidenceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const response = await fetch("/api/living-lab-plans", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load plans");
      setDrafts(data.plans as Plan[]);
    } catch { setNotice(th ? "อ่านแผนที่บันทึกไว้ไม่ได้ ข้อมูลใหม่ยังค้นและส่งออกได้" : "Saved plans are unavailable. Search and Markdown export remain available."); }
    finally { setPlansLoading(false); }
  }, [th]);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setNotice(""); setResult(null); setDraftId(""); setSaved(false); setStaleEvidenceIds([]);
    setFeedbackSent(false); setFeedbackError("");
    try {
      const response = await fetch("/api/research-assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), role, language: lang, robotId: robotId || undefined, allowGemini: geminiConfigured && aiConsent, adultConfirmed: geminiConfigured && aiConsent })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (th ? "ค้นข้อมูลไม่สำเร็จ" : "Search failed"));
      setResult(data as ResearchResponse);
      if (data.robotContext) { setRobotId(data.robotContext.id); setRobotName(data.robotContext.name); }
      setForm({ ...EMPTY_PLAN, question: question.trim(), role, evidence: data.evidence });
    } catch (failure) { setError(failure instanceof Error ? failure.message : (th ? "ค้นข้อมูลไม่สำเร็จ" : "Search failed")); }
    finally { setLoading(false); }
  }

  async function sendAnswerFeedback(vote: "HELPFUL" | "NOT_HELPFUL") {
    if (!result || feedbackSent) return;
    setFeedbackError("");
    try {
      const response = await fetch("/api/research-assistant/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote, questionCategory: result.intent || "general", robotId: robotId || null, externalSearchUsed: result.externalSearchStatus === "used" })
      });
      if (!response.ok) throw new Error("feedback unavailable");
      setFeedbackSent(true);
    } catch { setFeedbackError(th ? "ส่ง feedback ไม่สำเร็จ ลองอีกครั้งได้" : "Could not save feedback. Please try again."); }
  }

  function buildPlan() {
    if (!result?.evidence.length || !form.participantGroup.trim() || !form.siteContext.trim() || !form.activityGoal.trim()) return;
    setForm((current) => makePlan(current, th)); setNotice(th ? "สร้างร่าง readiness และกิจกรรมแล้ว ตรวจแก้ก่อนใช้จริง" : "Readiness and activity draft created. Review it before use.");
  }

  async function saveDraft() {
    if (saving || staleEvidenceIds.length) return;
    setSaving(true);
    setError(""); setNotice("");
    try {
      const payload = { ...form, evidence: form.evidence.map(({ id, type }) => ({ id, type })) };
      const response = await fetch("/api/living-lab-plans", {
        method: draftId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftId ? { id: draftId, plan: payload } : payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (th ? "บันทึกแผนไม่สำเร็จ" : "Could not save plan"));
      setDraftId(data.plan.id); setSaved(true); setNotice(th ? `บันทึกในฐานข้อมูลแล้ว · รุ่นที่ ${data.plan.revisionCount}` : `Saved to database · revision ${data.plan.revisionCount}`);
      await loadPlans();
    } catch (failure) { setError(failure instanceof Error ? failure.message : (th ? "บันทึกแผนไม่สำเร็จ" : "Could not save plan")); }
    finally { setSaving(false); }
  }

  function openDraft(plan: Plan) {
    setDraftId(plan.id); setSaved(true); setStaleEvidenceIds(plan.staleEvidenceIds ?? []); setQuestion(plan.question); setRole(plan.role); setForm({
      title: plan.title, objective: plan.objective, steps: plan.steps, question: plan.question, role: plan.role,
      participantGroup: plan.participantGroup, participantCount: plan.participantCount, siteContext: plan.siteContext,
      activityGoal: plan.activityGoal, sessionLength: plan.sessionLength, staffing: plan.staffing,
      readinessNotes: plan.readinessNotes, evidence: plan.evidence, feedback: ""
    });
    setResult({ answer: th ? "เปิดหลักฐาน snapshot ที่บันทึกไว้กับแผนนี้" : "Opened the evidence snapshot saved with this plan.", evidence: plan.evidence, mode: plan.evidence.length ? "extractive" : "no_results", role: plan.role, limitations: [], unknowns: [] });
    setError(""); setNotice(th ? `เปิดแผน · ${plan.revisionCount} รุ่น · หลักฐาน ณ ${new Date(plan.evidenceSnapshotAt).toLocaleString()}${plan.staleEvidenceIds?.length ? ` · หลักฐาน ${plan.staleEvidenceIds.length} รายการไม่อยู่ใน public corpus ปัจจุบัน (ยังเก็บ snapshot เดิม)` : ""}` : `Plan opened · ${plan.revisionCount} revisions · evidence snapshot ${new Date(plan.evidenceSnapshotAt).toLocaleString()}${plan.staleEvidenceIds?.length ? ` · ${plan.staleEvidenceIds.length} evidence item(s) are no longer in the current public corpus (saved snapshot retained)` : ""}`);
  }

  async function deleteDraft(id: string) {
    if (deletingId || !window.confirm(th ? "ลบแผนนี้พร้อมประวัติการแก้ไขทั้งหมดหรือไม่?" : "Delete this plan and all its revision history?")) return;
    setDeletingId(id);
    setError("");
    try {
      const response = await fetch("/api/living-lab-plans", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (th ? "ลบแผนไม่สำเร็จ" : "Could not delete plan"));
      if (draftId === id) { setDraftId(""); setSaved(false); setStaleEvidenceIds([]); setForm(EMPTY_PLAN); setResult(null); }
      setNotice(th ? "ลบแผนและประวัติรุ่นแล้ว" : "Plan and revision history deleted."); await loadPlans();
    } catch (failure) { setError(failure instanceof Error ? failure.message : (th ? "ลบแผนไม่สำเร็จ" : "Could not delete plan")); }
    finally { setDeletingId(""); }
  }

  function downloadDraft() {
    const lines = [
      `# ${form.title || (th ? "ร่างกิจกรรม Living Lab" : "Living Lab activity draft")}`, "",
      `## ${th ? "คำถามวิจัยและบทบาท" : "Research question and role"}`, form.question, `Role: ${form.role}`, "",
      `## ${th ? "บริบทกิจกรรม" : "Activity context"}`,
      `- ${th ? "ผู้เข้าร่วม" : "Participants"}: ${form.participantGroup || "—"} ${form.participantCount ? `(${form.participantCount})` : ""}`,
      `- ${th ? "สถานที่" : "Setting"}: ${form.siteContext || "—"}`, `- ${th ? "เป้าหมาย" : "Goal"}: ${form.activityGoal || "—"}`,
      `- ${th ? "ระยะเวลา" : "Session length"}: ${form.sessionLength || "—"}`, `- ${th ? "ผู้ดูแล" : "Staffing"}: ${form.staffing || "—"}`, "",
      `## ${th ? "เป้าหมาย" : "Objective"}`, form.objective || "—", "", `## ${th ? "ขั้นตอน" : "Steps"}`, form.steps || "—", "",
      `## ${th ? "ความพร้อมและสิ่งที่ต้องตรวจเพิ่ม" : "Readiness and open checks"}`, form.readinessNotes || "—", "",
      `## ${th ? "ข้อจำกัดของหลักฐาน" : "Evidence limits"}`, result?.answer || "—", "",
      `## ${th ? "หลักฐาน" : "Evidence"}`, ...form.evidence.map((item) => `- [${item.citation}] ${item.title} (${item.status})${item.url ? ` — ${item.url}` : ""}\n  ${item.excerpt || "Metadata only; no study outcome can be confirmed."}`)
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "humanoidth-living-lab-plan.md"; link.click(); URL.revokeObjectURL(url);
  }

  const update = (key: keyof PlanForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const hasEvidence = Boolean(result?.evidence.length);

  return <div style={{ display: "grid", gap: 18, maxWidth: 1000 }}>
    <header><h1>Pet AI · Research Assistant</h1><p className="muted">{th ? "ถามจากข้อมูล HumanoidTH พร้อมแหล่งอ้างอิง แล้วต่อยอดเป็นแผน HRI Living Lab ได้" : "Ask about HumanoidTH data with citations, then turn the evidence into an HRI Living Lab plan."}</p></header>

    {robotId && <section className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><span>{th ? "กำลังถามเกี่ยวกับ:" : "Asking about:"} <strong>{robotName || robotId}</strong></span><div style={{ display: "flex", gap: 8 }}><Link className="button" href="/robots">{th ? "เปลี่ยนหุ่นยนต์" : "Change robot"}</Link><button type="button" onClick={() => { setRobotId(""); setRobotName(""); }}>{th ? "เอาบริบทออก" : "Remove context"}</button></div></section>}

    <section className="panel" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 16, display: "grid", placeItems: "center", background: "#e9f7ee", fontSize: 25 }}>🤖</div>
      <div><strong>ผู้ช่วยค้นหลักฐาน · Evidence Assistant</strong><div>{loading ? (th ? "กำลังค้นหลักฐาน..." : "Searching evidence...") : saved ? (th ? "บันทึก/เปิดแผนแล้ว" : "Plan saved or reopened") : error ? (th ? "ต้องตรวจคำค้นหรือการเชื่อมต่อ" : "Needs a query or connection check") : result?.evidence.length ? (th ? "พบหลักฐาน · โปรดตรวจข้อจำกัด" : "Evidence ready · check the limitations") : result ? (th ? "ยังไม่พบหลักฐานที่ตรง" : "No matching evidence") : (th ? "เริ่มต้นด้วยคำถามหรือสถานการณ์ที่ต้องการค้นข้อมูล" : "Start with a question or study scenario")}</div></div>
    </section>

    <form onSubmit={ask} className="panel" style={{ display: "grid", gap: 12 }}>
      <label>{th ? "รูปแบบคำแนะนำ" : "Assistant role"}<select value={role} onChange={(event) => setRole(event.target.value as Role)} style={{ display: "block", marginTop: 6 }}>
        <option value="student">Student · {th ? "อธิบายศัพท์และวิธีอ่านหลักฐาน" : "terms and source-reading prompts"}</option>
        <option value="researcher">Researcher · {th ? "แบบศึกษา ประชากร ผลลัพธ์ ข้อจำกัด" : "design, population, outcomes, limits"}</option>
        <option value="company">Company · {th ? "แยก capability, ผู้ผลิต และหลักฐาน deployment" : "capability, manufacturer, deployment evidence"}</option>
        <option value="general">General · {th ? "สรุปสั้นและอ่านง่าย" : "plain-language overview"}</option>
      </select><small>{th ? "บทบาทมีผลต่อแนวทางการช่วยคิดเท่านั้น และไม่เปลี่ยนสิทธิ์การเข้าถึงข้อมูล" : "Role changes the guidance only; it never changes data access."}</small></label>
      <label>{th ? "คำถามหรือสถานการณ์" : "Question or scenario"}<textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} maxLength={500} required placeholder={th ? "ตัวอย่าง: เรามีหุ่นยนต์ NAO และต้องการจัดกิจกรรมสนทนากลุ่มกับผู้สูงอายุ ควรพิจารณาหลักฐานและข้อควรระวังอะไรบ้าง?" : "Example: We have a NAO for a group activity with older adults. What evidence and limits should we check?"} style={{ display: "block", width: "100%", marginTop: 6 }} /></label>
      <div><small>{th ? "ตัวอย่างคำถาม:" : "Try asking:"}</small><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>{(th ? ["ใครเป็นผู้ผลิตหุ่นยนต์รุ่นนี้?", "มีงานวิจัยที่เกี่ยวข้องอะไรบ้าง?", "รุ่นนี้ต่างจากรุ่นอื่นอย่างไร?", "มีข้อมูลราคาและการจำหน่ายหรือไม่?"] : ["Who makes it?", "What research is linked?", "Compare with another robot", "Is current pricing available?"]).map((sample) => <button key={sample} type="button" onClick={() => setQuestion(robotName ? `${robotName} ${sample}` : sample)}>{sample}</button>)}</div></div>
      {geminiConfigured && <label style={{ display: "flex", alignItems: "flex-start", gap: 8 }}><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /><span>{th ? "ฉันมีอายุอย่างน้อย 18 ปี และยินยอมให้ส่งคำถามกับข้อมูลสาธารณะที่ค้นพบไปยัง Google Gemini เพื่อช่วยตอบและค้นเว็บเพิ่มเติมเมื่อหลักฐานไม่พอหรือเป็นข้อมูลปัจจุบัน ฉันจะไม่ระบุชื่อหรือข้อมูลส่วนบุคคล" : "I am 18 or older and consent to sending my question and retrieved public records to Google Gemini for answers and, when evidence is insufficient or current information is requested, web search. Do not include personal data."}</span></label>}
      {!geminiConfigured && <small>{th ? "Gemini ยังไม่ได้ตั้งค่า · คำตอบจะแสดงข้อความจากรายการในระบบพร้อมแหล่งอ้างอิง" : "Gemini is not configured; answers use retrieved system excerpts with citations."}</small>}
      <button className="primary" type="submit" disabled={loading || question.trim().length < 3}>{loading ? (th ? "กำลังค้นฐานข้อมูล..." : "Searching HumanoidTH...") : (th ? "ค้นข้อมูลด้วย Pet AI" : "Ask Pet AI")}</button>
    </form>
    {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {staleEvidenceIds.length > 0 && <p role="alert" className="panel">{th ? `หลักฐาน ${staleEvidenceIds.length} รายการในแผนนี้ไม่อยู่ในชุดข้อมูลสาธารณะปัจจุบัน กรุณาค้นใหม่ก่อนบันทึก revision; ยังดาวน์โหลด snapshot เดิมได้` : `${staleEvidenceIds.length} evidence item(s) in this plan are no longer in the current public corpus. Search again before saving a revision; the saved snapshot can still be downloaded.`}</p>}

    {result && <section className="panel" aria-live="polite"><h2>{result.mode === "web" ? (th ? "คำตอบจากข้อมูลในระบบและการค้นเว็บ" : "Answer from system data and web search") : result.mode === "gemini" ? (th ? "ร่างสังเคราะห์จาก Gemini · ตรวจแหล่งอ้างอิง" : "Gemini-assisted draft · verify citations") : hasEvidence ? (th ? "สรุปผลค้นจากฐานข้อมูล" : "Database search summary") : (th ? "ไม่พบในชุดข้อมูลที่ค้น" : "Not found in the searched corpus")}</h2><p style={{ whiteSpace: "pre-wrap" }}>{result.answer.split(/(\[\d+\])/g).map((part, index) => { const match = /^\[(\d+)\]$/.exec(part); return match ? <a key={index} href={`#source-${match[1]}`}>{part}</a> : <span key={index}>{part}</span>; })}</p>
      {result.aiStatus === "unavailable" && <p role="status">{th ? "Gemini ใช้งานไม่ได้ในขณะนี้ จึงแสดงข้อความหลักฐานจากฐานข้อมูลพร้อมแหล่งอ้างอิงแทน" : "Gemini is unavailable; showing retrieved database excerpts with citations."}</p>}
      {result.aiStatus === "not_configured" && <p className="muted">{th ? "ยังไม่ได้ตั้งค่า Gemini API key/model · คำตอบนี้ยกข้อความที่ตรงจากข้อมูลในระบบพร้อม citation" : "Gemini API key/model are not configured; this answer quotes matching system records with citations."}</p>}
      {result.aiStatus === "not_consented" && <p className="muted">{th ? "ไม่ได้ส่งข้อมูลไป Gemini เพราะยังไม่ได้ให้ความยินยอม · คำตอบใช้ข้อความจากข้อมูลในระบบพร้อม citation" : "Nothing was sent to Gemini because consent was not given; the answer uses retrieved system excerpts with citations."}</p>}
      {result.aiStatus === "rate_limited" && <p role="status">{th ? "ถึงขีดจำกัดการเรียก Gemini ชั่วคราวแล้ว · แสดงข้อความหลักฐานจากฐานข้อมูลพร้อม citation" : "Gemini request limit reached; showing retrieved database excerpts with citations."}</p>}
      {result.externalSearchStatus === "not_consented" && <p className="muted">{th ? "หลักฐานยังไม่พอสำหรับคำตอบที่มั่นใจ · เปิดการยินยอมด้านบนเพื่อให้ค้นเว็บเพิ่มเติมได้" : "Evidence is limited; enable consent above to allow a web search."}</p>}
      {result.externalSearchStatus === "not_configured" && <p className="muted">{th ? "ยังไม่ได้ตั้งค่า Gemini · แสดงเฉพาะข้อมูลที่ค้นพบในระบบ" : "Gemini is not configured; showing only records found in the system."}</p>}
      {result.externalSearchStatus === "unavailable" && <p role="status">{th ? "ค้นเว็บเพิ่มเติมไม่สำเร็จ · แสดงข้อมูลที่พบในระบบและระบุส่วนที่ยังไม่ทราบ" : "Web search was unavailable; showing system records and noting what remains unknown."}</p>}
      {(hasEvidence || result.externalSources?.length) && <><h3>{th ? "ข้อจำกัดและสิ่งที่ยังไม่รู้" : "Limitations and unknowns"}</h3><ul>{(result.limitations || []).map((item, i) => <li key={`l${i}`}>{item}</li>)}{(result.unknowns || []).map((item, i) => <li key={`u${i}`}>{item}</li>)}</ul><small>{th ? "Accepted/Approved เป็นสถานะ workflow ไม่ใช่การตรวจข้อเท็จจริงอย่างอิสระ · AI ช่วยสรุปข้อมูล ไม่ใช่ผู้ประเมินหลักฐาน" : "Accepted/Approved are workflow states, not independent fact checks. AI summarizes evidence; it does not validate it."}</small></>}
    </section>}

    {hasEvidence && <section><h2>{th ? "หลักฐานที่พบ" : "Retrieved evidence"}</h2><EvidenceCards items={result?.evidence ?? []} th={th} /></section>}
    {result?.externalSources?.length ? <section><h2>{th ? "แหล่งข้อมูลจากเว็บ" : "Web sources"}</h2><ol style={{ display: "grid", gap: 8 }}>{result.externalSources.map((source) => <li id={`source-${source.citation}`} key={`${source.citation}-${source.url}`}><a href={source.url} target="_blank" rel="noreferrer">[{source.citation}] {source.title}</a> <small>({source.sourceKind === "academic" ? (th ? "แหล่งวิชาการ" : "Academic") : (th ? "เว็บภายนอก" : "External web")})</small></li>)}</ol></section> : null}

    {result && <section className="panel" style={{ display: "grid", gap: 12 }}>
      <h2>{th ? "แผน HRI Wellness Living Lab" : "HRI Wellness Living Lab plan"}</h2>
      <p className="muted">{th ? "ระบุบริบทเพื่อสร้าง checklist ด้าน feasibility/usability แผนและประวัติแก้ไขจะบันทึกในฐานข้อมูล โดยผูกกับ browser token แบบส่วนตัว" : "Add context to build a feasibility/usability checklist. Plans and revisions are saved in the database and scoped to a private browser token."}</p>
      <label>{th ? "กลุ่มผู้เข้าร่วม" : "Participant group"}<input value={form.participantGroup} onChange={(e) => update("participantGroup", e.target.value)} maxLength={160} style={{ display: "block", width: "100%" }} /></label>
      <label>{th ? "จำนวนผู้เข้าร่วม (ประมาณการ)" : "Participant count (estimate)"}<input value={form.participantCount} onChange={(e) => update("participantCount", e.target.value)} maxLength={40} style={{ display: "block", width: "100%" }} /></label>
      <label>{th ? "สถานที่/บริบท" : "Site or setting"}<input value={form.siteContext} onChange={(e) => update("siteContext", e.target.value)} maxLength={240} style={{ display: "block", width: "100%" }} /></label>
      <label>{th ? "เป้าหมายกิจกรรม" : "Activity goal"}<input value={form.activityGoal} onChange={(e) => update("activityGoal", e.target.value)} maxLength={240} style={{ display: "block", width: "100%" }} /></label>
      <label>{th ? "เวลาต่อครั้ง" : "Session length"}<input value={form.sessionLength} onChange={(e) => update("sessionLength", e.target.value)} maxLength={80} style={{ display: "block", width: "100%" }} /></label>
      <label>{th ? "ผู้ดูแล/ผู้ช่วยหน้างาน" : "Staffing or on-site support"}<input value={form.staffing} onChange={(e) => update("staffing", e.target.value)} maxLength={160} style={{ display: "block", width: "100%" }} /></label>
      <button type="button" onClick={buildPlan} disabled={!hasEvidence || !form.participantGroup.trim() || !form.siteContext.trim() || !form.activityGoal.trim()}>{th ? "สร้าง checklist และแผนกิจกรรม" : "Build readiness checklist and plan"}</button>
      <label>{th ? "ชื่อแผน" : "Plan title"}<input value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={120} style={{ display: "block", width: "100%" }} /></label>
      <label>{th ? "วัตถุประสงค์" : "Objective"}<textarea value={form.objective} onChange={(e) => update("objective", e.target.value)} rows={3} maxLength={1500} style={{ display: "block", width: "100%" }} /></label>
      <label>{th ? "ขั้นตอนและข้อควรระวัง" : "Steps and safeguards"}<textarea value={form.steps} onChange={(e) => update("steps", e.target.value)} rows={7} maxLength={6000} style={{ display: "block", width: "100%" }} /></label>
      <label>{th ? "ความพร้อม/ข้อกังวลที่ยังต้องตรวจ" : "Readiness gaps or concerns to check"}<textarea value={form.readinessNotes} onChange={(e) => update("readinessNotes", e.target.value)} rows={2} maxLength={1200} style={{ display: "block", width: "100%" }} /></label>
      <label>{th ? "สิ่งที่เรียนรู้หรือ feedback รอบนี้ (สร้าง revision ใหม่)" : "Learning or feedback from this round (creates a revision)"}<textarea value={form.feedback} onChange={(e) => update("feedback", e.target.value)} rows={2} maxLength={1000} style={{ display: "block", width: "100%" }} /></label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" className="primary" disabled={!form.title.trim() || !hasEvidence || saving || staleEvidenceIds.length > 0} onClick={saveDraft}>{saving ? (th ? "กำลังบันทึก..." : "Saving...") : draftId ? (th ? "บันทึก revision" : "Save revision") : (th ? "บันทึกแผน" : "Save plan")}</button><button type="button" onClick={downloadDraft}>{th ? "ดาวน์โหลด Markdown" : "Download Markdown"}</button></div>
    </section>}

    <section><h2>{th ? "แผน Living Lab ที่บันทึกไว้" : "Saved Living Lab plans"}</h2>{plansLoading ? <p>{th ? "กำลังโหลดแผน..." : "Loading plans..."}</p> : drafts.length ? <ul style={{ display: "grid", gap: 8, paddingLeft: 20 }}>{drafts.map((plan) => <li key={plan.id}>{plan.title} · {plan.revisionCount} {th ? "รุ่น" : "revisions"} <button type="button" onClick={() => openDraft(plan)}>{th ? "เปิด" : "Open"}</button> <button type="button" disabled={Boolean(deletingId)} onClick={() => void deleteDraft(plan.id)}>{deletingId === plan.id ? (th ? "กำลังลบ..." : "Deleting...") : (th ? "ลบ" : "Delete")}</button></li>)}</ul> : <p className="muted">{th ? "ยังไม่มีแผนที่บันทึกไว้ในเบราว์เซอร์นี้" : "No plans in this browser yet."}</p>}</section>
    {draftId && drafts.find((plan) => plan.id === draftId)?.revisions?.length ? <details className="panel"><summary>{th ? "ประวัติการปรับแผน" : "Plan revision history"}</summary><ol>{drafts.find((plan) => plan.id === draftId)!.revisions.map((revision, index) => <li key={`${revision.createdAt}-${index}`}>{new Date(revision.createdAt).toLocaleString()} · {revision.feedback || (th ? "ไม่มี feedback เพิ่ม" : "No additional feedback")}</li>)}</ol></details> : null}
  </div>;
}
