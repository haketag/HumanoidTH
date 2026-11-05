import Link from 'next/link';
import { prisma } from '@/lib/prisma';
export const dynamic='force-dynamic';
export const metadata={title:'บริษัทและองค์กร | HumanoidTH'};
export default async function CompaniesPage() {
  let rows:{id:string;published:{name:string;description:string;website:string}}[]=[];let unavailable=false;
  try {rows=await prisma.$queryRaw`SELECT id,published FROM "Company" WHERE published IS NOT NULL ORDER BY name`; }catch{unavailable=true;}
  return <section><h1>บริษัทและองค์กร</h1><p>โปรไฟล์ที่ผู้ดูแลอนุมัติให้เผยแพร่ การอนุมัติตัวแทนไม่ได้รับรองทุกข้อกล่าวอ้างของบริษัท</p><Link href="/company">ส่งข้อมูลในนามบริษัท</Link>{unavailable ? <p role="alert">ยังโหลดข้อมูลไม่ได้ กรุณาลองใหม่</p> : !rows.length ? <p>ยังไม่มีโปรไฟล์บริษัทที่อนุมัติให้เผยแพร่</p> : <div className="cards">{rows.map(row=><article className="card" key={row.id}><h2><Link href={`/companies/${row.id}`}>{row.published.name}</Link></h2><p>{row.published.description}</p><a href={row.published.website} target="_blank" rel="noopener noreferrer">เว็บไซต์บริษัท</a></article>)}</div>}</section>;
}
