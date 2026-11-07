export type ResearchErrorCode = "AI_AUTH" | "AI_MODEL" | "AI_CONFIGURATION" | "AI_QUOTA" | "AI_UNAVAILABLE" | "AI_TIMEOUT" | "INVALID_AI_RESPONSE" | "SOURCE_UNAVAILABLE" | "NO_SOURCES" | "UNSUPPORTED_CLAIM" | "RATE_LIMIT_UNAVAILABLE" | "INTERNAL_ERROR";
export class ResearchError extends Error {
  constructor(public code: ResearchErrorCode, public stage: string, public upstreamStatus?: number) { super(code); this.name = "ResearchError"; }
}
export function checkAiResponse(response: Response, stage: string) {
  if (response.ok) return;
  const code: ResearchErrorCode = [401,403].includes(response.status) ? "AI_AUTH" : response.status === 429 ? "AI_QUOTA" : response.status === 404 ? "AI_MODEL" : response.status === 400 ? "AI_CONFIGURATION" : "AI_UNAVAILABLE";
  throw new ResearchError(code, stage, response.status);
}
export function asResearchError(error: unknown, stage = "research"): ResearchError {
  if (error instanceof ResearchError) return error;
  if (error instanceof Error && ["AbortError","TimeoutError"].includes(error.name)) return new ResearchError("AI_TIMEOUT", stage);
  if (error instanceof SyntaxError) return new ResearchError("INVALID_AI_RESPONSE", stage);
  return new ResearchError("AI_UNAVAILABLE", stage);
}
export function researchErrorResponse(error: ResearchError, language: "th" | "en") {
  const messages: Record<ResearchErrorCode, [string,string]> = {
    AI_AUTH: ["บริการ AI ยืนยันตัวตนไม่ผ่าน กรุณาตรวจคีย์และสิทธิ์ของ project", "AI authentication failed. Check the project key and permissions."],
    AI_MODEL: ["โมเดล AI ที่ตั้งไว้ไม่พร้อมสำหรับ project นี้ กรุณาให้ผู้ดูแลตรวจชื่อโมเดล", "The configured model is unavailable for this project. Check model access."],
    AI_CONFIGURATION: ["การตั้งค่าคำขอ AI ไม่รองรับ กรุณาให้ผู้ดูแลตรวจการตั้งค่า", "The AI provider rejected the request configuration."],
    AI_QUOTA: ["โควตาบริการ AI ไม่พอ กรุณารอหรือให้ผู้ดูแลตรวจโควตา", "AI quota was exceeded. Wait or ask the administrator to check quota."],
    AI_UNAVAILABLE: ["บริการ AI ไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่", "The AI service is temporarily unavailable. Please retry."],
    AI_TIMEOUT: ["การค้นคว้าใช้เวลานานเกินกำหนด กรุณาลองใหม่", "Research timed out. Please retry."],
    INVALID_AI_RESPONSE: ["AI ส่งคำตอบมาไม่สมบูรณ์ กรุณาลองใหม่", "The AI returned an incomplete response. Please retry."],
    SOURCE_UNAVAILABLE: ["ยังเชื่อมต่อแหล่งค้นข้อมูลไม่ได้ กรุณาลองใหม่", "The search sources are temporarily unavailable."],
    NO_SOURCES: ["ไม่พบแหล่งข้อมูลที่ใช้ยืนยันคำตอบได้ ลองระบุหัวข้อให้ชัดขึ้น", "No usable supporting sources were found. Try a more specific question."],
    UNSUPPORTED_CLAIM: ["คำตอบที่ AI สร้างยังอ้างอิงหลักฐานได้ไม่ครบ จึงยังแสดงคำตอบไม่ได้ กรุณาลองใหม่", "The generated answer could not be fully matched to supporting evidence. Please retry."],
    RATE_LIMIT_UNAVAILABLE: ["ระบบจำกัดคำขอยังไม่พร้อม กรุณาลองใหม่ภายหลัง", "Request limiting is temporarily unavailable. Please retry later."],
    INTERNAL_ERROR: ["ระบบประมวลผลคำถามไม่สำเร็จ กรุณาลองใหม่", "The request could not be processed. Please retry."]
  };
  return { error: messages[error.code][language === "th" ? 0 : 1], code: error.code, status: error.code === "AI_QUOTA" ? 429 : error.code === "AI_TIMEOUT" ? 504 : error.code === "UNSUPPORTED_CLAIM" || error.code === "INVALID_AI_RESPONSE" ? 502 : 503 };
}
