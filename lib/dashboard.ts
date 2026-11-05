export type CountRow = { label: string; count: number };
const purposes: Record<string, [string, string]> = {
  healthcare_physical_therapy_robot: ['การแพทย์และฟื้นฟู', 'Healthcare & rehabilitation'],
  medical_delivery_robot: ['การแพทย์และฟื้นฟู', 'Healthcare & rehabilitation'],
  medical_telepresence_robot: ['การแพทย์และฟื้นฟู', 'Healthcare & rehabilitation'],
  medical_assistant_robot: ['การแพทย์และฟื้นฟู', 'Healthcare & rehabilitation'],
  rehabilitation_robot: ['การแพทย์และฟื้นฟู', 'Healthcare & rehabilitation'],
  assistive_wearable_robot: ['การแพทย์และฟื้นฟู', 'Healthcare & rehabilitation'],
  hospital_administrative_service_robot: ['การแพทย์และฟื้นฟู', 'Healthcare & rehabilitation'],
  companion_personal_assistant_robot: ['บริการและการดูแล', 'Service & care'],
  elderly_care_robot: ['บริการและการดูแล', 'Service & care'],
  social_service_robot: ['บริการและการดูแล', 'Service & care'],
  telepresence_robot_system: ['บริการและการดูแล', 'Service & care'],
  security_robot: ['ความปลอดภัย', 'Security'], public_safety_robot: ['ความปลอดภัย', 'Security'],
  education_robot: ['การศึกษา', 'Education'],
  humanoid_robot: ['หุ่นยนต์รูปร่างคล้ายมนุษย์', 'Humanoid platforms'],
  humanoid_full_body: ['หุ่นยนต์รูปร่างคล้ายมนุษย์', 'Humanoid platforms'],
};
// Display groups follow registry tags, not inferred or verified capabilities.
export function groupRobotTypes(rows: { robotType: string; _count: { _all: number } }[], thai: boolean): CountRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = purposes[row.robotType]?.[thai ? 0 : 1] || (thai ? 'ประเภทอื่น / ยังไม่จัดกลุ่ม' : 'Other / unclassified');
    counts.set(label, (counts.get(label) || 0) + row._count._all);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
export function share(count: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, count / total * 100)) : 0;
}
