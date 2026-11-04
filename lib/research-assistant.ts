export type EvidenceType = "source" | "robot" | "contribution";
export type ResearchRole = "student" | "researcher" | "company" | "general";

export type Evidence = {
  id: string;
  type: EvidenceType;
  title: string;
  excerpt: string;
  url: string | null;
  citation: number;
  status: string;
};

export type ResearchResponse = {
  answer: string;
  evidence: Evidence[];
  mode: "extractive" | "gemini" | "no_results";
  role: ResearchRole;
  limitations: string[];
  unknowns: string[];
  aiStatus?: "not_configured" | "not_consented" | "complete" | "unavailable" | "rate_limited";
};

const stopWords = new Set([
  "about", "after", "also", "from", "have", "into", "more", "that", "them", "there", "this", "what", "when", "where", "which", "with",
  "และ", "หรือ", "ของ", "ใน", "กับ", "จาก", "เกี่ยวกับ", "อะไร", "อย่างไร", "ไหม", "ได้", "มี", "เป็น", "ที่", "สำหรับ"
]);

export function searchTerms(question: string) {
  return [...new Set(question.toLocaleLowerCase().match(/[a-z0-9][a-z0-9-]{1,}|[ก-๙]{2,}/g) ?? [])]
    .filter((term) => !stopWords.has(term))
    .slice(0, 10);
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
    types.has("source") ? "แหล่งข้อมูล" : null,
    types.has("robot") ? "รุ่นหุ่นยนต์" : null,
    types.has("contribution") ? "ผลงานที่ส่งเข้าระบบ" : null
  ].filter(Boolean).join(", ");

  const answer = language === "th"
    ? `พบ ${evidence.length} รายการที่ตรงกับคำค้นจาก ${labels} ในชุดข้อมูลปัจจุบัน${role === "student" ? " เริ่มจากเปิดแหล่งอ้างอิงและแยกวัตถุประสงค์ วิธีศึกษา และผลที่รายงาน" : role === "researcher" ? " ใช้รายการเหล่านี้ตรวจประชากร บริบท วิธีเปรียบเทียบ และผลลัพธ์ที่รายงาน" : role === "company" ? " ตรวจแยกข้อมูล capability/ผู้ผลิตออกจากหลักฐานการนำไปใช้งานจริง" : " โปรดเปิดรายการอ้างอิงเพื่ออ่านบริบท"} ผลค้นนี้ไม่ใช่การยืนยันประสิทธิผลหรือข้อเท็จจริงโดยอิสระ`
    : `Found ${evidence.length} matching records from ${labels} in the current corpus.${role === "student" ? " Open sources and distinguish the study aim, method, and reported findings." : role === "researcher" ? " Check population, setting, comparator, and reported outcomes." : role === "company" ? " Separate declared capability/manufacturer details from deployment evidence." : " Open each source and review its context."} Search results do not independently verify facts or efficacy.`;
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
