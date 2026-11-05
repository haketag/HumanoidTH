import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { currentActor } from '@/lib/company-auth';
import { logoutUser } from '@/app/actions';
export const dynamic='force-dynamic';
export const metadata={title:'บัญชีของคุณ | HumanoidTH',robots:{index:false,follow:false}};
export default async function ProfilePage() {
  const actor=await currentActor();
  if(!actor) return <section><h1>บัญชีของคุณ</h1><p>เข้าสู่ระบบด้วยอีเมลและรหัสผ่านเพื่อดูข้อมูลของคุณ การเลือกอีเมลหรือบทบาทเองไม่ใช่การยืนยันตัวตน</p><Link href="/company">เข้าสู่ระบบ / สมัครบัญชี</Link></section>;
  const submissions=await prisma.submittedData.findMany({where:{submittedById:actor.id},orderBy:{createdAt:'desc'},take:50});
  return <section><h1>บัญชีของคุณ</h1><p>{actor.name} ({actor.email})</p><p>{actor.isAdmin ? 'ผู้ดูแลที่ได้รับอนุญาต' : 'สมาชิก — สิทธิ์บริษัทต้องได้รับการอนุมัติแยกต่างหาก'}</p><p><Link href="/company">พอร์ทัลบริษัทและสถานะข้อเสนอ</Link></p><form action={logoutUser}><button>ออกจากระบบ</button></form><h2>ข้อมูลชุมชนที่คุณส่งไว้ ({submissions.length})</h2>{submissions.length ? <div className="table-wrap"><table><thead><tr><th>หัวข้อ</th><th>ประเภท</th><th>สถานะ</th><th>คำแนะนำจากผู้ดูแล</th></tr></thead><tbody>{submissions.map(s=><tr key={s.id}><td>{s.title}</td><td>{s.submissionType}</td><td>{s.status}</td><td>{s.reviewNotes || 'รอการตรวจสอบ'}</td></tr>)}</tbody></table></div> : <p>ยังไม่มีข้อมูลชุมชนที่ส่งไว้</p>}</section>;
}
