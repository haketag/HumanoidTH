import type { Metadata } from "next";
import AdminConsolePage from "./AdminConsolePage";
import Link from 'next/link';

type SearchParams = Promise<{
  collection?: string;
  selectedId?: string;
}>;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Review Console",
  robots: { index: false, follow: false }
};

export default function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  return <><p><Link href="/company-review">ตรวจคำขอและข้อเสนอจากบริษัท / Company Review</Link></p><AdminConsolePage searchParams={searchParams} /></>;
}
