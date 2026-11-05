export const industries = [
  { id: 'healthcare', name: 'Healthcare & Wellness', th: 'สุขภาพและการดูแล', tasks: ['greeting', 'guidance', 'engagement'] },
  { id: 'manufacturing', name: 'Manufacturing & Industry', th: 'การผลิตและอุตสาหกรรม', tasks: ['handling', 'inspection', 'workstation'] },
  { id: 'hospitality', name: 'Hospitality & Service', th: 'การต้อนรับและบริการ', tasks: ['reception', 'information', 'delivery'] },
  { id: 'research', name: 'Research & Education', th: 'การวิจัยและการศึกษา', tasks: ['hri', 'programming', 'teaching'] },
] as const;
export const tasks: Record<string, { name: string; th: string; requirements: string[] }> = {
  greeting: { name: 'Patient / visitor greeting', th: 'ต้อนรับผู้ป่วยและผู้มาเยือน', requirements: ['Human interaction', 'Speech / communication'] },
  guidance: { name: 'Indoor guidance', th: 'นำทางภายในอาคาร', requirements: ['Human interaction', 'Speech / communication', 'Indoor navigation'] },
  engagement: { name: 'Social engagement', th: 'กิจกรรมและปฏิสัมพันธ์ทางสังคม', requirements: ['Human interaction', 'Speech / communication', 'Activity facilitation'] },
  handling: { name: 'Material handling', th: 'เคลื่อนย้ายวัสดุ', requirements: ['Manipulation', 'Object handling', 'Payload / transport'] },
  inspection: { name: 'Inspection assistance', th: 'ช่วยงานตรวจสอบ', requirements: ['Perception', 'Sensors', 'Mobility'] },
  workstation: { name: 'Repetitive workstation assistance', th: 'ช่วยงานซ้ำในสถานีทำงาน', requirements: ['Manipulation', 'Object handling', 'Programmability'] },
  reception: { name: 'Reception & greeting', th: 'ต้อนรับและรับรองแขก', requirements: ['Human interaction', 'Speech / communication'] },
  information: { name: 'Visitor information', th: 'ให้ข้อมูลผู้มาเยือน', requirements: ['Human interaction', 'Speech / communication', 'Information interface'] },
  delivery: { name: 'Indoor delivery', th: 'ส่งของภายในอาคาร', requirements: ['Indoor navigation', 'Payload / transport'] },
  hri: { name: 'HRI experiments', th: 'ทดลองปฏิสัมพันธ์มนุษย์กับหุ่นยนต์', requirements: ['Human interaction', 'Programmability', 'Sensors'] },
  programming: { name: 'Programming / research platform', th: 'แพลตฟอร์มเขียนโปรแกรมและวิจัย', requirements: ['Programmability', 'Research interfaces'] },
  teaching: { name: 'Demonstration / teaching', th: 'สาธิตและการสอน', requirements: ['Programmability', 'Activity facilitation'] },
};
export function selection(industry?: string, task?: string, other?: string) {
  const chosen = industries.find(i => i.id === industry);
  if (chosen && task === 'other' && typeof other === 'string' && other.trim() && other.trim().length <= 300) {
    return { industry: chosen, task: { name: other.trim(), th: other.trim(), requirements: [] as string[] } };
  }
  return { industry: chosen, task: chosen && chosen.tasks.some(t => t === task) && task ? tasks[task] : undefined };
}
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
// Current schema has no capability evidence relation; never promote descriptions or seed metadata into verified claims.
export function matchRobot(_robot: unknown, requirements: string[]) {
  return { supported: false, requirements: requirements.map(name => ({ name, status: 'Not verified' as const })) };
}
