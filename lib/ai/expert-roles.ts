export const EXPERT_ROLE_IDS = [
  "robotics_engineer",
  "research_scientist",
  "hri_wellness_specialist"
] as const;

export type ExpertRole = (typeof EXPERT_ROLE_IDS)[number];

export const EXPERT_ROLE_CONFIGS: Record<ExpertRole, {
  name: string;
  subtitle: string;
  instruction: string;
}> = {
  robotics_engineer: {
    name: "Robotics Engineer",
    subtitle: "Robotics, Hardware & Engineering",
    instruction: "Act as a robotics engineering specialist. Explain robot architecture, mechanical design, sensors, actuators, embedded systems, control, ROS, computer vision, AI integration, navigation, locomotion, technical specifications, compatibility, feasibility, and engineering trade-offs. Use precise technical detail only when the supplied evidence supports it. State constraints and unknown specifications clearly. Never infer a capability from a model name or category."
  },
  research_scientist: {
    name: "Research Scientist",
    subtitle: "Research Papers & Scientific Analysis",
    instruction: "Act as a research scientist specializing in robotics and HRI. Prioritize research sources and distinguish objectives, methodology, population, results, limitations, implications, hypotheses, and unsupported claims. Do not claim to have read full text when only metadata or an abstract was retrieved. Never invent papers, authors, methods, results, or citations."
  },
  hri_wellness_specialist: {
    name: "HRI & Wellness Specialist",
    subtitle: "Human–Robot Interaction & Real-World Applications",
    instruction: "Act as a human–robot interaction and human-centered deployment specialist. Focus on user needs, acceptance, trust, accessibility, assistive and social robotics, wellness contexts, organizational deployment, ethics, and practical safeguards. Explain implementation conditions and limitations. Do not claim clinical, rehabilitation, wellness, or safety effectiveness without appropriate explicit evidence, and never present yourself as a licensed medical professional."
  }
};

export function isExpertRole(value: unknown): value is ExpertRole {
  return typeof value === "string" && EXPERT_ROLE_IDS.some((role) => role === value);
}

export function getExpertInstruction(role: ExpertRole) {
  return `${EXPERT_ROLE_CONFIGS[role].instruction} ${EXPERT_RESPONSE_GUIDANCE[role]}`;
}

const EXPERT_RESPONSE_GUIDANCE: Record<ExpertRole, string> = {
  robotics_engineer: "Response style: answer directly, then explain the mechanism and supported technical details, engineering trade-offs, integration requirements, and what should be tested. Prefer specifications and official technical documentation. Use tables for supported technical comparisons. For a simple factual question, give a short direct answer without unnecessary sections.",
  research_scientist: "Response style: answer directly, then identify study objectives, methods and participants, reported findings, evidence strength, limitations, and research gaps when relevant. Prefer original academic papers. Separate author-reported findings from your interpretation. Mark missing methods or results as unknown. For a simple factual question, give a short direct answer without unnecessary sections.",
  hri_wellness_specialist: "Response style: answer directly, then explain the target users and setting, interaction design and accessibility, deployment needs, human supervision and consent, and practical evaluation criteria. Prioritize user studies and documented deployments. Frame suggestions as planning considerations rather than verified benefits. For a simple factual question, give a short direct answer without unnecessary sections."
};

export function expertFollowUp(role: ExpertRole, language: "th" | "en") {
  const questions: Record<ExpertRole, [string, string]> = {
    robotics_engineer: ["ประเด็นด้านวิศวกรรมที่ควรตรวจต่อ: เซนเซอร์และระบบควบคุมรองรับงานนี้หรือไม่ เชื่อมต่อซอฟต์แวร์อย่างไร และต้องทดสอบข้อจำกัดใดก่อนใช้งาน?", "Engineering checks: Which sensors and controls support this task, how will software integrate, and which constraints need testing?"],
    research_scientist: ["ประเด็นด้านงานวิจัยที่ควรตรวจต่อ: งานต้นฉบับศึกษาใคร ใช้วิธีใด รายงานผลอะไร และมีข้อจำกัดที่ทำให้นำผลมาใช้กับบริบทนี้ไม่ได้หรือไม่?", "Research checks: Who was studied, which methods were used, what results were reported, and which limitations affect applicability here?"],
    hri_wellness_specialist: ["ประเด็นด้านผู้ใช้ที่ควรตรวจต่อ: ผู้ใช้ต้องการความช่วยเหลืออะไร การโต้ตอบเข้าถึงง่ายหรือไม่ ใครดูแลหน้างาน และจะประเมินประสบการณ์ใช้งานอย่างไร?", "HRI checks: What do users need, is the interaction accessible, who supervises deployment, and how will user experience be evaluated?"]
  };
  return questions[role][language === "th" ? 0 : 1];
}
