import Link from 'next/link';
import { currentActor } from '@/lib/company-auth';
import CompanyPortal from '../company/portal';
export const dynamic='force-dynamic';
export const metadata={title:'Company Review | HumanoidTH',robots:{index:false,follow:false}};
export default async function CompanyReviewPage() {
  const actor=await currentActor();
  if(!actor?.isAdmin) return <section><h1>ตรวจข้อเสนอจากบริษัท</h1><p>เฉพาะผู้ดูแลที่เข้าสู่ระบบด้วยบัญชีที่ได้รับอนุญาต</p><Link href="/company">เข้าสู่ระบบ Company Portal</Link></section>;
  return <CompanyPortal admin/>;
}
