import { isComparisonQuestion } from "./ai/intent";

export type EvidenceType = "source" | "robot" | "contribution" | "perspective" | "inventory" | "organization";
export type ResearchRole = "student" | "researcher" | "company" | "general";

export type Evidence = {
  id: string;
  type: EvidenceType;
  title: string;
  excerpt: string;
  url: string | null;
  citation: number;
  status: string;
  facts?: Record<string, string>;
};

export type ExternalSource = { citation: number; title: string; url: string; sourceKind: "official" | "academic" | "external" };

export type ResearchResponse = {
  answer: string;
  evidence: Evidence[];
  mode: "extractive" | "gemini" | "web" | "no_results";
  role: ResearchRole;
  limitations: string[];
  unknowns: string[];
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  confidenceReason?: string;
  intent?: string;
  robotContext?: { id: string; name: string };
  externalSearchStatus?: "not_needed" | "not_configured" | "not_consented" | "unavailable" | "used";
  externalSources?: ExternalSource[];
  aiStatus?: "not_configured" | "not_consented" | "complete" | "unavailable" | "rate_limited";
};

const MAX_EXTRACTIVE_CLAIMS = 3;
const MAX_EXCERPT_LENGTH = 360;

const stopWords = new Set([
  "about", "after", "also", "from", "have", "into", "more", "that", "them", "there", "this", "what", "when", "where", "which", "with",
  "และ", "หรือ", "ของ", "ใน", "กับ", "จาก", "เกี่ยวกับ", "อะไร", "อย่างไร", "ไหม", "ได้", "มี", "เป็น", "ที่", "สำหรับ"
]);

export function searchTerms(question: string) {
  return [...new Set(question.toLocaleLowerCase().match(/[a-z0-9][a-z0-9-]{1,}|[ก-๙]{2,}/g) ?? [])]
    .filter((term) => !stopWords.has(term))
    .slice(0, 10);
}

function normalizedText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function evidenceScore(item: Evidence, terms: string[], question: string) {
  const title = normalizedText(item.title);
  const excerpt = normalizedText(item.excerpt);
  const exactQuestion = normalizedText(question);
  const titleHits = terms.filter((term) => title.includes(term)).length;
  const excerptHits = terms.filter((term) => excerpt.includes(term)).length;
  return titleHits * 6 + excerptHits + (exactQuestion.length > 3 && title.includes(exactQuestion) ? 12 : 0);
}

export function rankEvidence<T extends Evidence>(evidence: T[], question: string) {
  const terms = searchTerms(question);
  return evidence
    .map((item, index) => ({ item, index, score: evidenceScore(item, terms, question) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

function excerptForAnswer(item: Evidence, terms: string[]) {
  const text = item.excerpt.replace(/\r/g, "").trim();
  if (!text) return "";

  const segments = text.split(/\n+|(?<=[.!?。！？])\s+/).map((segment) => segment.replace(/\s+/g, " ").trim()).filter(Boolean);
  const best = segments
    .map((segment, index) => ({
      segment,
      index,
      score: terms.filter((term) => normalizedText(segment).includes(term)).length
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.segment ?? text;
  if (best.length <= MAX_EXCERPT_LENGTH) return best;

  const lower = normalizedText(best);
  const firstMatch = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, Math.min(firstMatch - 120, best.length - MAX_EXCERPT_LENGTH));
  const end = Math.min(best.length, start + MAX_EXCERPT_LENGTH);
  const nextWord = best.slice(start).indexOf(" ");
  const left = start > 0 ? start + (nextWord >= 0 ? nextWord + 1 : 0) : 0;
  const rightSpace = best.lastIndexOf(" ", end);
  const excerpt = best.slice(left, rightSpace > left ? rightSpace : end).trim();
  return `${left > 0 ? "…" : ""}${excerpt}${rightSpace < best.length - 1 ? "…" : ""}`;
}

export function safeSourceUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function comparisonAnswer(evidence: Evidence[], language: "th" | "en") {
  const robots = evidence.filter((item) => item.type === "robot");
  if (robots.length < 2) return null;
  const fields = [
    { key: "manufacturer", en: "Manufacturer", th: "ผู้ผลิต" },
    { key: "countryOfOrigin", en: "Country of origin", th: "ประเทศต้นทาง" },
    { key: "robotType", en: "Robot type", th: "ประเภทหุ่นยนต์" },
    { key: "primaryUseCase", en: "Reported use case", th: "การใช้งานที่รายงาน" },
    { key: "thailandStatus", en: "Thailand status", th: "สถานะในประเทศไทย" },
    { key: "specifications", en: "Specifications", th: "ข้อมูลทางเทคนิค" },
    { key: "capabilities", en: "Reported capabilities", th: "ความสามารถที่รายงาน" }
  ];
  const availableFields = fields.filter((field) => robots.some((robot) => robot.facts?.[field.key]));
  const unknown = language === "th" ? "ยังไม่มีข้อมูลยืนยัน" : "Not verified in HumanoidTH";
  const rows = availableFields.map((field) => {
    const values = robots.map((robot) => `${robot.facts?.[field.key] || unknown} [${robot.citation}]`);
    return `${language === "th" ? field.th : field.en}: ${robots.map((robot, index) => `${robot.title} ${values[index]}`).join(" · ")}`;
  });
  return language === "th"
    ? `เปรียบเทียบจากข้อมูลที่มีใน HumanoidTH:\n${rows.join("\n")}\nแสดงเฉพาะฟิลด์ที่มีในอย่างน้อยหนึ่งรายการ ช่องที่ขาดระบุว่า “${unknown}”; ข้อมูลที่ผู้ผลิตรายงานไม่ใช่การตรวจสอบอิสระ`
    : `Comparison from available HumanoidTH records:\n${rows.join("\n")}\nOnly fields present in at least one record are listed. Missing values are marked “${unknown}”. Manufacturer-reported data is not independent verification.`;
}

export function excerptAnswer(evidence: Evidence[], question: string, role: ResearchRole = "general", language: "th" | "en" = "th"): ResearchResponse {
  if (!evidence.length) {
    return {
      answer: language === "th"
        ? `ไม่พบรายการที่ตรงกับ “${question}” ในชุดข้อมูลที่ค้นได้ของ HumanoidTH การไม่พบข้อมูลไม่ยืนยันว่าไม่มีงานหรือหุ่นในโลกจริง`
        : `No matching record was found for “${question}” in the searched HumanoidTH corpus. This does not establish that no relevant work or robot exists.`,
      evidence: [],
      mode: "no_results", role, limitations: [],
      unknowns: [language === "th" ? "อาจยังไม่มีข้อมูลในระบบ หรือคำค้น/alias ไม่ตรงกับ metadata ที่นำเข้า" : "The corpus may lack the record, or the query/alias may not match indexed metadata."]
    };
  }

  const types = new Set(evidence.map((item) => item.type));
  const labels = [
    types.has("source") ? (language === "th" ? "แหล่งข้อมูล" : "source records") : null,
    types.has("robot") ? (language === "th" ? "รุ่นหุ่นยนต์" : "robot models") : null,
    types.has("contribution") ? (language === "th" ? "ผลงานที่ส่งเข้าระบบ" : "public contributions") : null,
    types.has("perspective") ? (language === "th" ? "มุมมองที่เชื่อมกับแหล่งข้อมูลที่ยอมรับ" : "perspective annotations linked to accepted sources") : null,
    types.has("inventory") ? (language === "th" ? "รายการคลังที่เปิดเผยสาธารณะ" : "public inventory records") : null,
    types.has("organization") ? (language === "th" ? "โปรไฟล์องค์กรที่เผยแพร่แล้ว" : "published organization profiles") : null
  ].filter(Boolean).join(", ");

  const terms = searchTerms(question);
  const claims = evidence.slice(0, MAX_EXTRACTIVE_CLAIMS).map((item) => {
    const excerpt = excerptForAnswer(item, terms);
    if (!excerpt) {
      return language === "th"
        ? `[${item.citation}] ${item.title}: มีเพียงข้อมูลกำกับในระบบ ยังไม่มีข้อความที่ใช้ตอบรายละเอียดหรือยืนยันผลการศึกษา`
        : `[${item.citation}] ${item.title}: metadata only; the record does not contain text to answer details or establish study outcomes`;
    }
    return `[${item.citation}] ${item.title}: ${excerpt}`;
  });
  const comparison = isComparisonQuestion(question) ? comparisonAnswer(evidence, language) : null;
  const answer = comparison || (language === "th"
    ? `จากข้อมูลในระบบที่ตรงกับคำถาม พบ ${evidence.length} รายการ${labels ? ` จาก ${labels}` : ""} ข้อความที่เกี่ยวข้อง:\n${claims.join("\n")}${role === "researcher" ? "\nควรตรวจประชากร วิธีศึกษา ตัวเปรียบเทียบ และผลลัพธ์ในต้นฉบับก่อนสรุปผล" : role === "company" ? "\nแยกข้อมูล capability/ผู้ผลิตออกจากหลักฐานการนำไปใช้งานจริง" : ""}`
    : `From ${evidence.length} matching ${labels || "records"} in the system, the retrieved evidence says:\n${claims.join("\n")}${role === "researcher" ? "\nCheck the original study's population, methods, comparator, and outcomes before drawing conclusions." : role === "company" ? "\nSeparate capability/manufacturer claims from evidence of real-world deployment." : ""}`);
  const metadataOnly = evidence.filter((item) => !item.excerpt.trim()).length;
  const limitations = language === "th"
    ? ["สถานะ Accepted/Approved เป็น workflow label ไม่ใช่การตรวจสอบข้อเท็จจริงโดยอิสระ", "ผลค้นอิง metadata/ข้อความที่นำเข้า ไม่ใช่การทบทวนวรรณกรรมอย่างเป็นระบบ", "ระบบยังตรวจจับผลการศึกษาที่ขัดแย้งกันโดยอัตโนมัติไม่ได้", "หากไม่ระบุประชากร วิธี และผลลัพธ์ใน record จะสรุปผลของกิจกรรมไม่ได้", ...(metadataOnly ? [`${metadataOnly} รายการมีเฉพาะ metadata ไม่มีข้อความพอรองรับข้อสรุปผลการศึกษา`] : [])]
    : ["Accepted/Approved are workflow labels, not independent fact verification.", "Retrieval uses imported metadata/text; it is not a systematic review.", "The prototype does not automatically detect conflicting study findings.", "Records without population, methods, or outcomes cannot establish activity effects.", ...(metadataOnly ? [`${metadataOnly} record(s) contain metadata only and cannot support study-outcome claims.`] : [])];
  const unknowns = language === "th"
    ? role === "company" ? ["ยังไม่ทราบราคา การสนับสนุนหลังการขาย และความพร้อมหน้างาน เว้นแต่ record ระบุไว้", "ยังไม่ยืนยันว่า capability ที่ประกาศใช้ได้ใน deployment นี้"]
      : role === "researcher" ? ["ยังไม่ยืนยันความเสี่ยงอคติ การเปรียบเทียบ และการถ่ายโอนผลระหว่างประชากร/สถานที่", "ยังไม่ทราบข้อมูลที่ record ไม่ได้รายงาน"]
        : role === "student" ? ["ตรวจว่าข้อความในต้นฉบับรองรับข้อสรุปจริงหรือไม่ และมองหาข้อจำกัดที่ผู้วิจัยระบุ"]
          : ["ยังไม่ยืนยันว่าแผนกิจกรรมนี้เหมาะกับคนหรือสถานที่เฉพาะ จนกว่าจะตรวจต้นฉบับและปรึกษาผู้ดูแล"]
    : role === "company" ? ["Price, support, and deployment readiness are unknown unless records explicitly report them.", "Declared capabilities are not verified for this deployment."]
      : role === "researcher" ? ["Bias, comparator quality, and transferability across populations/sites are not established here.", "Details omitted from records remain unknown."]
        : role === "student" ? ["Check whether the original source supports each conclusion and identify author-reported limitations."]
          : ["Suitability for a particular person or site is unknown until original sources and local requirements are reviewed."];
  return { answer, evidence, mode: "extractive", role, limitations, unknowns };
}
