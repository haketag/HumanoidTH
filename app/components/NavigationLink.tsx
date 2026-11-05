'use client';

import Link, { useLinkStatus } from 'next/link';
import { useState, type ReactNode } from 'react';

const publicPages=new Set(['/','/dashboard','/robots','/companies','/contributions','/match','/favorites','/network','/perspectives']);
function Pending() {
  const {pending}=useLinkStatus();
  return pending ? <span className="nav-pending" role="status" aria-label="กำลังเปิดหน้า / Opening page"/> : null;
}
export default function NavigationLink({href,className,children,current}:{href:string;className?:string;children:ReactNode;current?:boolean}) {
  const [intent,setIntent]=useState(false);
  const warm=()=>{if(publicPages.has(href)) setIntent(true);};
  return <Link href={href} className={className} aria-current={current ? 'page' : undefined} prefetch={intent ? true : null} onPointerEnter={warm} onFocus={warm}>
    {children}<Pending/>
  </Link>;
}
