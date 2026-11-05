import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
export const dynamic='force-dynamic';
export default async function CompanyPublicPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const rows=await prisma.$queryRaw<{published:{name:string;description:string;website:string;logoUrl:string;contactEmail:string;contact:string}}[]>`SELECT published FROM "Company" WHERE id=${id} AND published IS NOT NULL`;
  if(!rows[0]) notFound();
  const p=rows[0].published;
  const robots=await prisma.$queryRaw<{id:string;canonicalName:string}[]>`SELECT r.id,r."canonicalName" FROM "RobotModel" r JOIN "CompanyRobot" l ON l."robotId"=r.id WHERE l."companyId"=${id}`;
  const research=await prisma.$queryRaw<{id:string;title:string;sourceUrl:string}[]>`SELECT c.id,c.title,c."sourceUrl" FROM "Contribution" c JOIN "CompanySubmission" s ON s."publicId"=c.id WHERE s."companyId"=${id} AND s.status='APPROVED' AND s.kind='RESEARCH' AND c.visibility='public'`;
  return <section style={{maxWidth:900}}><Link href="/companies">บริษัทและองค์กร</Link>{p.logoUrl && <img src={p.logoUrl} alt={`โลโก้ ${p.name}`} width={100} height={100} style={{objectFit:'contain'}} referrerPolicy="no-referrer"/>}<h1>{p.name}</h1><p>{p.description}</p><a href={p.website} target="_blank" rel="noopener noreferrer">เว็บไซต์ทางการ</a><p>ติดต่อ: {p.contactEmail} {p.contact}</p><p className="notice">โปรไฟล์และความสัมพันธ์กับองค์กรผ่านการตรวจโดยผู้ดูแล ข้อมูลความสามารถจากบริษัทไม่ใช่ผลยืนยันโดยอิสระ</p><h2>หุ่นยนต์ที่เชื่อมโยง</h2>{robots.length ? <ul>{robots.map(r=><li key={r.id}><Link href={`/robots/${r.id}`}>{r.canonicalName}</Link></li>)}</ul> : <p>ยังไม่มีรายการที่อนุมัติ</p>}<h2>งานวิจัยและเอกสาร</h2>{research.length ? <ul>{research.map(r=><li key={r.id}><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">{r.title}</a></li>)}</ul> : <p>ยังไม่มีเอกสารที่อนุมัติ</p>}</section>;
}
