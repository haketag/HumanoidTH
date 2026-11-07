import { safeSourceUrl } from "../research-assistant";

type RobotFields = {
  canonicalName: string;
  manufacturer: string | null;
  developerOrg: string | null;
  countryOfOrigin: string | null;
  robotType: string;
  primaryUseCase: string | null;
  thailandStatus: string;
  officialUrl: string | null;
  description: string | null;
  sourceMeta: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function robotFacts(robot: RobotFields): Record<string, string> {
  const facts: Record<string, string> = {};
  const put = (key: string, value: unknown) => {
    const text = clean(value);
    if (text) facts[key] = text;
  };
  put("manufacturer", robot.manufacturer || robot.developerOrg);
  put("countryOfOrigin", robot.countryOfOrigin);
  put("robotType", robot.robotType === "unknown" ? "" : robot.robotType.replaceAll("_", " "));
  put("primaryUseCase", robot.primaryUseCase);
  put("thailandStatus", robot.thailandStatus === "observed_in_thailand" ? "Observed in Thailand; availability is not established" : robot.thailandStatus.replaceAll("_", " "));

  const meta = record(robot.sourceMeta);
  const submission = record(meta.companySubmission);
  const claimStatus = clean(submission.claimStatus, 160);
  put("specifications", submission.specifications);
  const capabilities = Array.isArray(submission.capabilities) ? submission.capabilities : [];
  const reported = capabilities.slice(0, 5).flatMap((item) => {
    const claim = record(item);
    const text = clean(claim.claim, 240);
    const source = safeSourceUrl(typeof claim.source === "string" ? claim.source : null);
    return text && source ? [`${text} (${source})`] : [];
  });
  if (reported.length) facts.capabilities = `${claimStatus || "Manufacturer-reported; not independently validated"}: ${reported.join("; ")}`;
  return facts;
}

export function robotEvidenceExcerpt(robot: RobotFields, facts: Record<string, string>) {
  const lines = [robot.description, ...Object.entries(facts).map(([key, value]) => `${key}: ${value}`)].filter(Boolean);
  return lines.join("\n").slice(0, 1800);
}

export function isInventoryQuestion(question: string) {
  return /\b(inventory|in stock|owned|unit in thailand|how many units)\b|คลัง|มีหุ่น|จำนวนตัว|ครอบครอง/u.test(question);
}

export function robotCatalogAnswer(evidence: Array<{ type: string; title: string; citation: number }>, language: "th" | "en") {
  const robots = evidence.filter((item) => item.type === "robot");
  if (!robots.length) return language === "th"
    ? "ขณะนี้ไม่พบระเบียนหุ่นยนต์ในชุดข้อมูล HumanoidTH ที่ค้นได้"
    : "No robot records were found in the searchable HumanoidTH dataset.";
  const list = robots.map((robot) => `[${robot.citation}] ${robot.title}`).join("\n");
  return language === "th"
    ? `พบระเบียนหุ่นยนต์ ${robots.length} รุ่นใน HumanoidTH:\n${list}\n\nรายการนี้อ้างอิงจากระเบียนที่แสดงในระบบ ณ เวลาค้นหา และอาจไม่ครอบคลุมทั้งหมด โปรดเปิดแหล่งอ้างอิงเพื่อตรวจรายละเอียด`
    : `Found ${robots.length} robot records in HumanoidTH:\n${list}\n\nThis reflects records shown in the system at search time and may not be exhaustive. Open the citations to review details.`;
}

export function isOrganizationQuestion(question: string) {
  return /\b(company|organization|manufacturer|developer|who makes|who made)\b|บริษัท|องค์กร|ผู้ผลิต|ผู้พัฒนา/u.test(question);
}

export function isPerspectiveQuestion(question: string) {
  return /\b(attitude|perception|perspective|sentiment|opinion)\b|มุมมอง|ความเห็น|ทัศนคติ/u.test(question);
}
