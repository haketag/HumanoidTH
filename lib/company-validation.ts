import { z } from 'zod';

export function publicUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && host.includes('.') && !host.endsWith('.local') && !host.endsWith('.localhost') && !host.includes(':') && !/^\d+\.\d+\.\d+\.\d+$/.test(host);
  } catch { return false; }
}
const url = z.string().trim().max(2000).refine(publicUrl, 'ใช้ URL http/https ของเว็บไซต์สาธารณะ');
const image = url.refine(value => publicUrl(value) && new URL(value).protocol === 'https:' && /\.(png|jpe?g|webp)$/i.test(new URL(value).pathname), 'ภาพต้องเป็นลิงก์ HTTPS ชนิด PNG, JPG หรือ WebP');
const short = z.string().trim().min(2).max(180);
const description = z.string().trim().min(10).max(8000);
export const credentials = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(12).max(128), name: short.optional() }).strict();
export const accessRequest = z.object({ name: short, website: url, businessEmail: z.string().trim().toLowerCase().email().max(254), evidence: z.string().trim().min(20).max(4000) }).strict();
export const profileData = z.object({ name: short, description, website: url, logoUrl: image.or(z.literal('')).default(''), contactEmail: z.string().trim().email().max(254), contact: z.string().trim().max(1000).default('') }).strict();
export const robotData = z.object({ name: short, modelIdentifier: z.string().trim().max(180).default(''), description, robotType: z.string().trim().min(2).max(100), officialUrl: url, sources: z.array(url).min(1).max(12), imageUrl: image.or(z.literal('')).default(''), specifications: z.string().trim().max(6000).default(''), capabilities: z.array(z.object({ claim: z.string().trim().min(2).max(1000), source: url }).strict()).max(20).default([]) }).strict();
export const researchData = z.object({ title: short, authors: z.string().trim().min(2).max(1000), description, sourceUrl: url, doi: z.string().trim().max(250).refine(value => !value || /^10\.\d{4,9}\/\S+$/i.test(value), 'DOI ไม่ถูกต้อง').default(''), documentType: z.enum(['research_paper', 'technical_document', 'product_manual']), robotId: z.string().max(100).default(''), relationshipEvidence: url.or(z.literal('')).default('') }).strict().refine(value => !value.robotId || !!value.relationshipEvidence, 'ระบุแหล่งที่อธิบายความเกี่ยวข้องกับหุ่นยนต์');
export type ProposalKind = 'PROFILE' | 'ROBOT' | 'RESEARCH';
export function validateProposal(kind: ProposalKind, value: unknown) {
  if (kind === 'PROFILE') return profileData.parse(value);
  if (kind === 'ROBOT') return robotData.parse(value);
  if (kind === 'RESEARCH') return researchData.parse(value);
  throw new Error('Unsupported submission type');
}
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('access'), data: accessRequest }).strict(),
  z.object({ action: z.literal('resubmitAccess'), id: z.string().min(1).max(100), version: z.number().int().positive(), evidence: z.string().trim().min(20).max(4000) }).strict(),
  z.object({ action: z.literal('draft'), companyId: z.string().min(1).max(100), kind: z.enum(['PROFILE','ROBOT','RESEARCH']), proposed: z.unknown(), targetRobotId: z.string().max(100).optional() }).strict(),
  z.object({ action: z.literal('save'), id: z.string().min(1).max(100), version: z.number().int().positive(), proposed: z.unknown() }).strict(),
  z.object({ action: z.literal('submit'), id: z.string().min(1).max(100), version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('review'), id: z.string().min(1).max(100), version: z.number().int().positive(), target: z.enum(['membership','submission']), decision: z.enum(['APPROVED','REJECTED','CHANGES_REQUESTED']), feedback: z.string().trim().min(5).max(4000), verifiedRelationship: z.boolean().default(false) }).strict(),
]);
export type CompanyCommand = z.infer<typeof commandSchema>;
export function companyKey(name: string) { return name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '); }
export function companyDomain(website: string) { return new URL(website).hostname.toLowerCase().replace(/^www\./, ''); }
