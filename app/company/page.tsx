import CompanyPortal from './portal';
import { cookies } from 'next/headers';
export const dynamic='force-dynamic';
export const metadata={title:'Company Portal | HumanoidTH',robots:{index:false,follow:false}};
export default async function CompanyPage() {
  const lang = (await cookies()).get('lang')?.value === 'th' ? 'th' : 'en';
  return <CompanyPortal lang={lang} />;
}
