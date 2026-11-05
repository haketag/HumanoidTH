import { prisma } from "@/lib/prisma";
import Link from 'next/link';
import { ExternalLink, ArrowUpRight } from "lucide-react";
import { robotProfile } from "@/lib/robot-profile";
import "./robots.css";
import FavoriteButton from '../components/FavoriteButton';
import RobotSourceImage from '../components/RobotSourceImage';
import { getPublicImageSources } from '@/lib/public-source-cache';
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslation } from "@/lib/translations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Robot Model Registry | Thailand Humanoid Atlas",
  description: "Comprehensive catalog of humanoid, social, and service robot models deployed, researched, or active in Thailand. Track specifications, developers, and source links.",
  alternates: { canonical: "/robots" },
  openGraph: {
    title: "Robot Model Registry | Thailand Humanoid Atlas",
    description: "Comprehensive catalog of humanoid, social, and service robot models deployed, researched, or active in Thailand. Track specifications, developers, and source links.",
    url: "/robots",
    siteName: "Thailand Humanoid Atlas",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Thailand Humanoid Atlas Logo"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Robot Model Registry | Thailand Humanoid Atlas",
    description: "Comprehensive catalog of humanoid, social, and service robot models deployed, researched, or active in Thailand. Track specifications, developers, and source links.",
    images: ["/logo.png"]
  }
};
import { getRobotSourceImage, type SourceLike } from '@/lib/robot-images';

export default async function RobotsPage() {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value || "en") as "en" | "th";
  const t = getTranslation(lang);

  let robots: Array<{
    id: string;
    canonicalName: string;
    description: string | null;
    robotType: string;
    thailandStatus: string;
    manufacturer: string | null;
    developerOrg: string | null;
    primaryUseCase: string | null;
    officialUrl: string | null;
    sourceMeta: unknown;
  }> = [];
  let sources: SourceLike[] = [];
  let dbOffline = false;

  try {
    [robots, sources] = await Promise.all([
      prisma.robotModel.findMany({ orderBy: { canonicalName: "asc" }, take: 200 }),
      getPublicImageSources()
    ]);
  } catch (error) {
    console.error("Database query failed in robots page:", error);
    dbOffline = true;
    robots = [];
    sources = [];
  }

  return (
    <>
      <h1>{t.robotsTitle}</h1>
      <Link href="/match">Humanoid Match</Link>
      <p className="muted" style={{ marginBottom: "18px" }}>{t.robotsDesc}</p>
      {dbOffline && (
        <div className="notice" style={{ marginBottom: 16 }}>
          Live database records are unavailable. No substitute robot registry records are being shown.
        </div>
      )}
      <div className="cards">
        {robots.map((robot) => {
          const bannerUrl = getRobotSourceImage(robot, sources);
          const profile = robotProfile(robot.sourceMeta, robot.officialUrl);
          return (
            <article className="card" key={robot.id}>
              <RobotSourceImage url={bannerUrl} name={robot.canonicalName} sourceMeta={robot.sourceMeta}/>
              <h2><Link className="robot-title-link" href={`/robots/${encodeURIComponent(robot.id)}`}>{robot.canonicalName}</Link></h2>
              <FavoriteButton robotId={robot.id} name={robot.canonicalName}/>
              <Link className="button robot-details-button" href={`/robots/${encodeURIComponent(robot.id)}`}>{lang === "th" ? "ดูภาพและรายละเอียด" : "Photos & details"}<ArrowUpRight size={16} aria-hidden="true" /></Link>
              <p className="muted">{lang === "th" ? profile.descriptionTh || robot.description || "ยังไม่มีรายละเอียด" : robot.description ?? "No description yet."}</p>
              <p><span className="badge">{robot.robotType}</span> <span className="badge">{robot.thailandStatus}</span></p>
              <p><strong>{robot.manufacturer ?? robot.developerOrg ?? "Unknown developer"}</strong><br />{robot.primaryUseCase ?? "Use case unclassified"}</p>
              {profile.sourceUrl && <a className="button robot-source-button" href={profile.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${lang === "th" ? "เปิดเอกสารต้นทางของ" : "Open original source for"} ${robot.canonicalName} (${lang === "th" ? "แท็บใหม่" : "new tab"})`}><ExternalLink size={16} aria-hidden="true" />{lang === "th" ? "เปิดเอกสารต้นทาง" : "Original source"}</a>}
              <div style={{ marginTop: 10 }}><Link className="button" href={`/research-assistant?q=${encodeURIComponent(`What evidence and limitations are available for ${robot.canonicalName}?`)}`}>Ask Research Assistant</Link></div>
            </article>
          );
        })}
        {!robots.length && <div className="empty">No robot models yet. Add seeds with `pnpm db:seed` or import sources.</div>}
      </div>
    </>
  );
}
