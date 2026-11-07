export type ResearchIntent = "comparison" | "current_information" | "recommendation" | "robot_detail" | "research" | "general";

const currentPatterns = [
  /\b(price|pricing|cost|available|availability|for sale|latest|current|recent|firmware|release|updated)\b/i,
  /ราคา|ค่าตัว|มีขาย|มีจำหน่าย|พร้อมจำหน่าย|ล่าสุด|ปัจจุบัน|อัปเดต|เฟิร์มแวร์|รุ่นใหม่/u
];
const comparisonPatterns = [/\b(compare|comparison|versus|vs\.?|difference|different)\b/i, /เปรียบเทียบ|ต่างกัน|เทียบกับ/u];
const recommendationPatterns = [/\b(recommend|suitable|fit for|best for|which robot|use case)\b/i, /แนะนำ|เหมาะกับ|เลือกหุ่น|หุ่นตัวไหน/u];
const researchPatterns = [/\b(study|research|paper|evidence|trial|participants|method)\b/i, /งานวิจัย|หลักฐาน|บทความ|การศึกษา|ทดลอง/u];
const robotDetailPatterns = [/\b(robot|manufacturer|developer|who makes|who made|which company makes|robot model)\b/i, /หุ่นยนต์|ผู้ผลิต|ผู้พัฒนา/u];

export function classifyResearchIntent(question: string, hasRobotContext = false): ResearchIntent {
  if (comparisonPatterns.some((pattern) => pattern.test(question))) return "comparison";
  if (currentPatterns.some((pattern) => pattern.test(question))) return "current_information";
  if (recommendationPatterns.some((pattern) => pattern.test(question))) return "recommendation";
  if (robotDetailPatterns.some((pattern) => pattern.test(question))) return "robot_detail";
  if (researchPatterns.some((pattern) => pattern.test(question))) return "research";
  if (hasRobotContext) return "robot_detail";
  return "general";
}

export function questionNeedsFreshnessCheck(question: string) {
  return currentPatterns.some((pattern) => pattern.test(question));
}

export function isComparisonQuestion(question: string) {
  return comparisonPatterns.some((pattern) => pattern.test(question));
}

export function detectQuestionLanguage(question: string, fallback: "th" | "en" = "en"): "th" | "en" {
  const thaiCharacters = (question.match(/[\u0E00-\u0E7F]/g) || []).length;
  const latinCharacters = (question.match(/[A-Za-z]/g) || []).length;
  if (thaiCharacters >= 2 && thaiCharacters >= latinCharacters * 0.15) return "th";
  if (latinCharacters >= 3 && latinCharacters > thaiCharacters) return "en";
  return fallback;
}
