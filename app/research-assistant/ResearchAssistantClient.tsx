"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Square, Plus, Search, PanelLeft, Copy, RotateCcw, Sparkles, ArrowLeft, X } from "lucide-react";
import { safeSourceUrl, type Evidence, type ResearchResponse } from "@/lib/research-assistant";
import { parseChatHistory, serializeChatHistory, type StoredConversation as ChatConversation, type StoredConversationTurn as ConversationTurn } from "@/lib/ai/chat-history";

type PlanRole = "student" | "researcher" | "company" | "general";
type ExpertRole = "robotics_engineer" | "research_scientist" | "hri_wellness_specialist";
const CHAT_STORAGE_KEY = "humanoidth-pet-ai-conversations-v1";
const MAX_CHAT_CONVERSATIONS = 30;
const MAX_CHAT_MESSAGES = 8;
const EXPERT_ROLES: Array<{ id: ExpertRole; name: string; subtitle: string; icon: string; examples: [string, string] }> = [
  { id: "robotics_engineer", name: "Robotics Engineer", subtitle: "Robotics, Hardware & Engineering", icon: "⚙️", examples: ["Unitree G1 ทำอะไรได้บ้าง?", "LiDAR กับกล้อง Depth ต่างกันอย่างไร?"] },
  { id: "research_scientist", name: "Research Scientist", subtitle: "Research Papers & Scientific Analysis", icon: "🔬", examples: ["ช่วยหางานวิจัยเกี่ยวกับ Humanoid Robot", "สรุป Paper นี้ให้หน่อย"] },
  { id: "hri_wellness_specialist", name: "HRI & Wellness Specialist", subtitle: "Human–Robot Interaction & Real-World Applications", icon: "🤝", examples: ["หุ่นยนต์ช่วยดูแลผู้สูงอายุได้จริงไหม?", "การออกแบบ HRI ที่ดีควรเป็นอย่างไร?"] }
];

function inlineMarkdown(text: string, prefix: string, citations: Set<number>, urls: Set<string>) {
  const tokenPattern = /(\[\d+\]|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));
    const key = `${prefix}-${index}`;
    const citation = /^\[(\d+)\]$/.exec(token);
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
    if (citation && citations.has(Number(citation[1]))) parts.push(<a key={key} href={`#source-${citation[1]}`}>{token}</a>);
    else if (link) {
      const safeUrl = safeSourceUrl(link[2]);
      parts.push(safeUrl && urls.has(safeUrl) ? <a key={key} href={safeUrl} target="_blank" rel="noreferrer">{link[1]}</a> : link[1]);
    } else if (/^\*\*[^*]+\*\*$/.test(token)) parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (/^`[^`]+`$/.test(token)) parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    else parts.push(token);
    cursor = index + token.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function AnswerMarkdown({ text, evidence, externalSources = [] }: { text: string; evidence: Evidence[]; externalSources?: NonNullable<ResearchResponse["externalSources"]> }) {
  const citations = new Set([...evidence.map((item) => item.citation), ...externalSources.map((item) => item.citation)]);
  const urls = new Set([...evidence.flatMap((item) => [item.url, item.documentUrl].filter((url): url is string => Boolean(url)).map((url) => safeSourceUrl(url)).filter((url): url is string => Boolean(url))), ...externalSources.map((item) => safeSourceUrl(item.url)).filter((url): url is string => Boolean(url))]);
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let index = 0;
  const renderTableCells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  const isTableDivider = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const fence = /^```([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = []; index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<pre key={`code-${index}`}><code className={fence[1] ? `language-${fence[1]}` : undefined}>{code.join("\n")}</code></pre>);
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const content = inlineMarkdown(heading[2], `heading-${index}`, citations, urls);
      const key = `heading-${index++}`;
      if (heading[1].length === 1) blocks.push(<h2 key={key}>{content}</h2>);
      else if (heading[1].length === 2) blocks.push(<h3 key={key}>{content}</h3>);
      else blocks.push(<h4 key={key}>{content}</h4>);
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = renderTableCells(line); index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) rows.push(renderTableCells(lines[index++]));
      blocks.push(<div key={`table-${index}`} style={{ overflowX: "auto" }}><table><thead><tr>{headers.map((cell, column) => <th key={column}>{inlineMarkdown(cell, `th-${index}-${column}`, citations, urls)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, column) => <td key={column}>{inlineMarkdown(row[column] || "", `td-${index}-${rowIndex}-${column}`, citations, urls)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const listItem = /^\s*([-*+]|\d+\.)\s+(.+)$/.exec(line);
    if (listItem) {
      const ordered = /^\d+\.$/.test(listItem[1]); const items: string[] = [];
      while (index < lines.length) {
        const item = /^\s*([-*+]|\d+\.)\s+(.+)$/.exec(lines[index]);
        if (!item || /^\d+\.$/.test(item[1]) !== ordered) break;
        items.push(item[2]); index += 1;
      }
      const contents = items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, `list-${index}-${itemIndex}`, citations, urls)}</li>);
      blocks.push(ordered ? <ol key={`list-${index}`}>{contents}</ol> : <ul key={`list-${index}`}>{contents}</ul>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={`quote-${index}`}>{quote.map((item, quoteIndex) => <p key={quoteIndex}>{inlineMarkdown(item, `quote-${index}-${quoteIndex}`, citations, urls)}</p>)}</blockquote>);
      continue;
    }
    const paragraph = [line]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,4}\s|```|>\s?)/.test(lines[index]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[index]) && !(lines[index].includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1]))) paragraph.push(lines[index++]);
    blocks.push(<p key={`p-${index}`}>{inlineMarkdown(paragraph.join(" "), `p-${index}`, citations, urls)}</p>);
  }
  return <div className="pet-ai-answer-markdown">{blocks}</div>;
}

function toPlanRole(role: ExpertRole): PlanRole {
  return role === "research_scientist" ? "researcher" : role === "robotics_engineer" ? "company" : "general";
}

function fromPlanRole(role: PlanRole): ExpertRole {
  return role === "researcher" ? "research_scientist" : role === "company" ? "robotics_engineer" : "hri_wellness_specialist";
}

type Plan = {
  id: string; title: string; objective: string; steps: string; question: string; role: PlanRole;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [robotId, setRobotId] = useState(initialRobotId);
  const [robotName, setRobotName] = useState(initialRobotName);
  const [expertRole, setExpertRole] = useState<ExpertRole>("hri_wellness_specialist");
  const [roleChosen, setRoleChosen] = useState(Boolean(initialQuestion || initialRobotId));
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
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [chatsReady, setChatsReady] = useState(false);
  const abortController = useRef<AbortController | null>(null);
  const activeConversation = conversations.find((item) => item.id === selectedConversationId) || null;
  const activeMessages = activeConversation?.messages || [];

  useEffect(() => { if (activeMessages.length || loading) messagesEndRef.current?.scrollIntoView({ block: "end" }); }, [activeMessages.length, loading, selectedConversationId]);

  useEffect(() => {
    const chats = parseChatHistory(localStorage.getItem(CHAT_STORAGE_KEY));
    setConversations(chats);
    const resumeSavedChat = !initialQuestion && !initialRobotId ? chats[0] : undefined;
    setSelectedConversationId(resumeSavedChat?.id || "");
    if (resumeSavedChat) {
      setExpertRole(resumeSavedChat.expertRole);
      setRobotId(resumeSavedChat.robotId || initialRobotId);
      setRobotName(resumeSavedChat.robotName || initialRobotName);
      setRoleChosen(true);
      const lastTurn = resumeSavedChat.messages.at(-1);
      setResult(lastTurn?.response || null);
      setQuestion(initialQuestion);
    } else {
      setQuestion(initialQuestion);
    }
    setChatsReady(true);
  }, [initialQuestion, initialRobotId, initialRobotName]);

  useEffect(() => {
    if (!chatsReady) return;
    try { localStorage.setItem(CHAT_STORAGE_KEY, serializeChatHistory(conversations.slice(0, MAX_CHAT_CONVERSATIONS))); }
    catch { setNotice(th ? "พื้นที่จัดเก็บประวัติในเบราว์เซอร์เต็ม · บทสนทนาปัจจุบันยังใช้งานต่อได้" : "Browser storage is full; the current chat still works."); }
  }, [conversations, chatsReady, th]);

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

  async function runQuestion(questionToAsk: string, regenerate = false) {
    const askedQuestion = questionToAsk.trim();
    if (askedQuestion.length < 3 || loading || !geminiConfigured || !aiConsent) return;
    setPendingQuestion(askedQuestion); setQuestion(""); setLoading(true); setError(""); setNotice(""); setResult(null); setDraftId(""); setSaved(false); setStaleEvidenceIds([]);
    const contextMessages = regenerate ? activeMessages.slice(0, -1) : activeMessages;
    const history = contextMessages.slice(-3).flatMap((turn) => [
      { role: "user" as const, content: turn.question.slice(0, 800) },
      { role: "assistant" as const, content: turn.answer.slice(0, 800) }
    ]).slice(-6);
    const conversationId = activeConversation?.id || "";
    const requestController = new AbortController();
    abortController.current = requestController;
    try {
      const response = await fetch("/api/research-assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: requestController.signal,
        body: JSON.stringify({ question: askedQuestion, history, role: toPlanRole(expertRole), expertRole, language: lang, robotId: robotId || undefined, allowGemini: geminiConfigured && aiConsent, adultConfirmed: geminiConfigured && aiConsent })
      });
      const data = await response.json();
      if (requestController.signal.aborted) return;
      if (!response.ok) throw new Error((data.error || (th ? "ค้นข้อมูลไม่สำเร็จ" : "Search failed")) + (data.requestId ? " (" + data.requestId.slice(0, 8) + ")" : ""));
      setResult(data as ResearchResponse);
      const chatId = conversationId || ("chat-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
      const now = new Date().toISOString();
      const turn: ConversationTurn = { id: "turn-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), question: askedQuestion, answer: data.answer, expertRole, response: data as ResearchResponse };
      setConversations((current) => {
        const existing = current.find((chat) => chat.id === chatId);
        const updated: ChatConversation = existing
          ? { ...existing, title: existing.messages.length ? existing.title : askedQuestion.slice(0, 80), expertRole, robotId: data.robotContext?.id || robotId, robotName: data.robotContext?.name || robotName, messages: [...(regenerate ? existing.messages.slice(0, -1) : existing.messages), turn].slice(-MAX_CHAT_MESSAGES), updatedAt: now }
          : { id: chatId, title: askedQuestion.slice(0, 80), expertRole, robotId: data.robotContext?.id || robotId, robotName: data.robotContext?.name || robotName, messages: [turn], createdAt: now, updatedAt: now };
        return [updated, ...current.filter((chat) => chat.id !== chatId)].slice(0, MAX_CHAT_CONVERSATIONS);
      });
      setSelectedConversationId(chatId); setRoleChosen(true);
      if (data.robotContext) { setRobotId(data.robotContext.id); setRobotName(data.robotContext.name); }
      setForm({ ...EMPTY_PLAN, question: askedQuestion, role: toPlanRole(expertRole), evidence: data.evidence });
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === "AbortError")) { setQuestion(askedQuestion); setError(failure instanceof Error ? failure.message : (th ? "ค้นข้อมูลไม่สำเร็จ" : "Search failed")); }
    } finally { if (abortController.current === requestController) abortController.current = null; setLoading(false); setPendingQuestion(""); }
  }

  function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runQuestion(question);
  }

  function startNewChat() {
    if (loading) abortController.current?.abort();
    setSelectedConversationId(""); setQuestion(""); setResult(null); setError(""); setNotice(""); setDraftId(""); setSaved(false);
    setExpertRole("hri_wellness_specialist"); setRoleChosen(false); setRobotId(""); setRobotName(""); setSidebarOpen(false);
  }

  function selectChat(chat: ChatConversation) {
    if (loading) abortController.current?.abort();
    setSelectedConversationId(chat.id); setExpertRole(chat.expertRole); setRoleChosen(true);
    setRobotId(chat.robotId || ""); setRobotName(chat.robotName || ""); setQuestion("");
    setError(""); setNotice(""); setDraftId(""); setSaved(false); setStaleEvidenceIds([]);
    const lastTurn = chat.messages.at(-1);
    setResult(lastTurn?.response || null);
    setSidebarOpen(false);
  }

  function switchExpertRole(nextRole: ExpertRole) {
    setExpertRole(nextRole); setRoleChosen(true); setForm((current) => ({ ...current, role: toPlanRole(nextRole) }));
    if (activeConversation) setConversations((current) => current.map((chat) => chat.id === activeConversation.id ? { ...chat, expertRole: nextRole, updatedAt: new Date().toISOString() } : chat));
  }

  async function copyAnswer() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.answer);
      setNotice(th ? "คัดลอกคำตอบแล้ว" : "Answer copied.");
    } catch { setNotice(th ? "คัดลอกไม่ได้ในเบราว์เซอร์นี้" : "Clipboard access is unavailable in this browser."); }
  }

  function regenerateAnswer() {
    const lastTurn = activeMessages.at(-1);
    if (lastTurn) void runQuestion(lastTurn.question, true);
  }

  function renameChat(chat: ChatConversation) {
    const title = window.prompt(th ? "ตั้งชื่อบทสนทนา" : "Rename conversation", chat.title);
    if (title?.trim()) setConversations((current) => current.map((item) => item.id === chat.id ? { ...item, title: title.trim().slice(0, 80), updatedAt: new Date().toISOString() } : item));
  }

  function deleteChat(chat: ChatConversation) {
    if (!window.confirm(th ? "ลบบทสนทนานี้ออกจากเบราว์เซอร์หรือไม่?" : "Delete this conversation from this browser?")) return;
    const next = conversations.filter((item) => item.id !== chat.id);
    setConversations(next);
    if (selectedConversationId === chat.id) {
      setSelectedConversationId(next[0]?.id || "");
      setResult(next[0]?.messages.at(-1)?.response || null);
      setQuestion(next[0]?.messages.at(-1)?.question || "");
      if (next[0]) { setExpertRole(next[0].expertRole); setRobotId(next[0].robotId); setRobotName(next[0].robotName); setRoleChosen(true); }
      else { setRoleChosen(false); setQuestion(""); setResult(null); }
    }
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
    setDraftId(plan.id); setSaved(true); setStaleEvidenceIds(plan.staleEvidenceIds ?? []); setQuestion(plan.question); setExpertRole(fromPlanRole(plan.role)); setRoleChosen(true); setForm({
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

  const visibleChats = conversations.filter((chat) => chat.title.toLocaleLowerCase().includes(chatSearch.toLocaleLowerCase()));

  return <div className="pet-chat-shell">
    {sidebarOpen && <button className="pet-chat-backdrop" aria-label={th ? "ปิดประวัติแชต" : "Close chat history"} onClick={() => setSidebarOpen(false)} />}
    <aside className={"pet-chat-sidebar" + (sidebarOpen ? " is-open" : "")} aria-label={th ? "ประวัติแชต" : "Chat history"}>
      <div className="pet-chat-brand"><Link href="/" aria-label="HumanoidTH"><span className="pet-chat-mark"><Sparkles size={20} /></span><strong>Pet AI</strong></Link><button className="pet-chat-icon mobile-only" onClick={() => setSidebarOpen(false)} aria-label={th ? "ปิดเมนู" : "Close menu"}><X size={19}/></button></div>
      <button type="button" className="pet-chat-new" onClick={startNewChat}><Plus size={19}/>{th ? "แชตใหม่" : "New chat"}</button>
      <label className="pet-chat-search"><Search size={16}/><span className="pet-chat-sr-only">{th ? "ค้นหาบทสนทนา" : "Search chats"}</span><input placeholder={th ? "ค้นหาบทสนทนา" : "Search chats"} value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} maxLength={80}/></label>
      <p className="pet-chat-history-label">{th ? "บทสนทนาล่าสุด" : "Recent conversations"}</p>
      <nav className="pet-chat-history" aria-label={th ? "บทสนทนาที่บันทึกไว้" : "Saved conversations"}>
        {!chatsReady ? <p className="pet-chat-empty-note" role="status">{th ? "กำลังโหลด..." : "Loading..."}</p> : visibleChats.length ? visibleChats.map((chat) => <div className={"pet-chat-history-row" + (chat.id === selectedConversationId ? " is-active" : "")} key={chat.id}>
          <button className="pet-chat-history-title" aria-current={chat.id === selectedConversationId ? "page" : undefined} onClick={() => selectChat(chat)} title={chat.title}>{chat.title}</button>
          <details className="pet-chat-history-menu"><summary aria-label={th ? "จัดการบทสนทนา" : "Conversation options"}>···</summary><div><button onClick={() => renameChat(chat)}>{th ? "เปลี่ยนชื่อ" : "Rename"}</button><button onClick={() => deleteChat(chat)}>{th ? "ลบ" : "Delete"}</button></div></details>
        </div>) : <p className="pet-chat-empty-note">{th ? "เริ่มบทสนทนาแรกของคุณ" : "Start your first conversation"}</p>}
      </nav>
      <div className="pet-chat-sidebar-footer"><Link href="/robots"><ArrowLeft size={16}/>{th ? "กลับไป HumanoidTH" : "Back to HumanoidTH"}</Link><small>{th ? "ประวัติแชตเก็บเฉพาะในเบราว์เซอร์นี้" : "Chat history stays in this browser"}</small></div>
    </aside>
    <div className="pet-chat-main">
      <header className="pet-chat-topbar"><div><button type="button" className="pet-chat-icon mobile-only" onClick={() => setSidebarOpen(true)} aria-label={th ? "เปิดประวัติแชต" : "Open chat history"}><PanelLeft size={21}/></button><span className="pet-chat-title">Pet AI <span>Research Assistant</span></span></div><label className="pet-chat-role-select"><span className="pet-chat-sr-only">{th ? "ผู้เชี่ยวชาญ" : "Expert role"}</span><select aria-label={th ? "ผู้เชี่ยวชาญ" : "Expert role"} value={expertRole} disabled={loading} onChange={(event) => switchExpertRole(event.target.value as ExpertRole)}>{EXPERT_ROLES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></header>
      <div className="pet-chat-scroll">
        <div className="pet-chat-thread">
          {robotId && <div className="pet-chat-context"><span>{th ? "บริบท:" : "Context:"} <strong>{robotName || robotId}</strong></span><button className="pet-chat-icon" onClick={() => { setRobotId(""); setRobotName(""); }} aria-label={th ? "เอาบริบทออก" : "Remove context"}><X size={15}/></button></div>}
          {!activeMessages.length && !result && !loading && <section className="pet-chat-welcome"><span className="pet-chat-welcome-mark"><Sparkles size={30}/></span><p className="pet-chat-eyebrow">HUMANOIDTH · RESEARCH COMPANION</p><h1>{th ? "วันนี้อยากค้นคว้าเรื่องอะไร?" : "What would you like to explore?"}</h1><p>{th ? "เลือกผู้เชี่ยวชาญ แล้วเริ่มค้นคว้าพร้อมแหล่งอ้างอิง" : "Choose an expert and explore ideas with cited sources."}</p><div className="pet-chat-experts">{EXPERT_ROLES.map((item) => <button className={"pet-chat-expert" + (roleChosen && expertRole === item.id ? " is-selected" : "")} key={item.id} onClick={() => switchExpertRole(item.id)}><span className="pet-chat-expert-icon" aria-hidden="true">{item.icon}</span><strong>{item.name}</strong><span>{item.subtitle}</span><small>{item.examples[0]}</small></button>)}</div></section>}
          {activeMessages.map((turn, index) => <article className="pet-chat-turn" key={turn.id}><div className="pet-chat-user"><span className="pet-chat-sr-only">{th ? "คุณ:" : "You:"}</span>{turn.question}</div><div className="pet-chat-assistant"><div className="pet-chat-assistant-label"><Sparkles size={17}/><strong>{EXPERT_ROLES.find((item) => item.id === turn.expertRole)?.name || "Pet AI"}</strong></div><AnswerMarkdown text={turn.answer} evidence={turn.response.evidence} externalSources={turn.response.externalSources}/>{turn.response.researchProvider === "public" && <p className="pet-chat-notice">{th ? "แหล่งค้น: Wikipedia / Crossref · บทนำ บทคัดย่อ และข้อมูลบรรณานุกรม" : "Sources: Wikipedia / Crossref · introductions, abstracts and bibliographic metadata"}</p>}
            {(turn.response.externalSources?.length || turn.response.evidence.length) ? <details className="pet-chat-sources"><summary>{th ? "แหล่งอ้างอิง" : "Sources"} <span>{turn.response.evidence.length + (turn.response.externalSources?.length || 0)}</span></summary><ol>{turn.response.evidence.map((source) => <li id={"source-" + source.citation} key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">[{source.citation}] {source.title}</a> : <span>[{source.citation}] {source.title}</span>}</li>)}{turn.response.externalSources?.map((source) => <li id={"source-" + source.citation} key={source.url}><a href={source.url} target="_blank" rel="noreferrer">[{source.citation}] {source.title}</a></li>)}</ol></details> : null}
            <div className="pet-chat-answer-actions"><button className="pet-chat-icon" onClick={() => { if (index === activeMessages.length - 1) void copyAnswer(); else void navigator.clipboard.writeText(turn.answer).catch(() => setNotice(th ? "คัดลอกไม่ได้" : "Could not copy.")); }} aria-label={th ? "คัดลอกคำตอบ" : "Copy answer"} title={th ? "คัดลอกคำตอบ" : "Copy answer"}><Copy size={16}/></button>{index === activeMessages.length - 1 && <button className="pet-chat-icon" disabled={loading} onClick={regenerateAnswer} aria-label={th ? "สร้างคำตอบใหม่" : "Regenerate answer"} title={th ? "สร้างคำตอบใหม่" : "Regenerate answer"}><RotateCcw size={16}/></button>}</div>
          </div></article>)}
          {!activeMessages.length && result && <section className="pet-chat-assistant"><AnswerMarkdown text={result.answer} evidence={result.evidence} externalSources={result.externalSources}/></section>}
          {loading && <div className="pet-chat-turn"><div className="pet-chat-user">{pendingQuestion}</div><div className="pet-chat-assistant pet-chat-loading" role="status"><Sparkles size={18}/><span>{th ? "กำลังค้นคว้าและเรียบเรียงคำตอบ…" : "Researching and composing an answer…"}</span></div></div>}
          {error && <div className="pet-chat-error" role="alert">{error}</div>}
          {notice && <p className="pet-chat-notice" role="status">{notice}</p>}
          {staleEvidenceIds.length > 0 && <p className="pet-chat-notice">{th ? "หลักฐานในแผนนี้อาจไม่เป็นปัจจุบัน กรุณาตรวจใหม่ก่อนบันทึก" : "Some plan evidence may be outdated. Review it before saving."}</p>}
          {(result || drafts.length > 0) && <details className="pet-chat-tools"><summary>{th ? "เครื่องมือและแผน Living Lab" : "Living Lab tools and plans"}</summary><div className="pet-chat-tools-content">    {result && <section className="panel" style={{ display: "grid", gap: 12 }}>
      <h2>{th ? "แผน HRI Wellness Living Lab" : "HRI Wellness Living Lab plan"}</h2>{saved && <small role="status">{th ? "บันทึกแผนแล้ว" : "Plan saved"}</small>}
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
</div></details>}
          <div ref={messagesEndRef}/>
        </div>
      </div>
      <div className="pet-chat-compose-area"><div className="pet-chat-compose-width">
        {!activeMessages.length && roleChosen && <div className="pet-chat-suggestions">{EXPERT_ROLES.find((item) => item.id === expertRole)?.examples.map((suggestion) => <button key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div>}
        <form onSubmit={ask} className="pet-chat-composer"><label className="pet-chat-sr-only" htmlFor="pet-chat-question">{th ? "คำถามของคุณ" : "Your question"}</label><textarea id="pet-chat-question" value={question} onChange={(event) => { setQuestion(event.target.value); event.target.style.height = "auto"; event.target.style.height = Math.min(event.target.scrollHeight, 150) + "px"; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void runQuestion(question); } }} rows={2} maxLength={500} required placeholder={th ? "ถาม Pet AI ได้เลย…" : "Ask Pet AI anything…"}/><div className="pet-chat-composer-bottom"><span><Sparkles size={14}/>{EXPERT_ROLES.find((item) => item.id === expertRole)?.name}</span>{loading ? <button className="pet-chat-send" type="button" onClick={() => { setQuestion(pendingQuestion); abortController.current?.abort(); }} aria-label={th ? "หยุดสร้างคำตอบ" : "Stop generation"}><Square size={16} fill="currentColor"/></button> : <button className="pet-chat-send" type="submit" disabled={question.trim().length < 3 || !geminiConfigured || !aiConsent} aria-label={th ? "ส่งคำถาม" : "Send message"}><ArrowUp size={22}/></button>}</div></form>
        {geminiConfigured ? <label className="pet-chat-consent"><input type="checkbox" checked={aiConsent} disabled={loading} onChange={(event) => setAiConsent(event.target.checked)}/><span>{th ? "ฉันอายุ 18 ปีขึ้นไป และยินยอมส่งคำถามและข้อมูลสาธารณะที่เกี่ยวข้องให้ Google Gemini เพื่อค้นคว้าและตอบคำถาม" : "I am 18+ and consent to sending my question and related public records to Google Gemini for research and answers."}</span></label> : <p className="pet-chat-notice">{th ? "บริการ AI ยังไม่ได้ตั้งค่า" : "AI research is not configured."}</p>}
        <p className="pet-chat-footnote">{th ? "ตรวจสอบแหล่งอ้างอิงก่อนนำข้อมูลไปใช้ · Shift + Enter เพื่อขึ้นบรรทัดใหม่" : "Check cited sources before use · Shift + Enter for a new line"}</p>
      </div></div>
    </div>
  </div>;
}
