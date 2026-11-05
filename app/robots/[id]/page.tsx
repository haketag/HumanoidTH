import Link from 'next/link';
import FavoriteButton from '../../components/FavoriteButton';
import RobotSourceImage from '../../components/RobotSourceImage';
import { getRobotSourceImage } from '@/lib/robot-images';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { safeUrl, selection } from '@/lib/humanoid-match';
export const dynamic = 'force-dynamic';
export default async function RobotDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ industry?: string; task?: string; other?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const chosen = selection(query.industry, query.task, query.other);
  let robot;
  try { robot = await prisma.robotModel.findUnique({ where: { id }, include: { contributions: { where: { visibility: 'public' } } } }); }
  catch { return <p role="alert">Database unavailable. Please try again later. <Link href="/robots">Robot registry</Link></p>; }
  if (!robot) notFound();
  const url = safeUrl(robot.officialUrl);
  const meta = robot.sourceMeta as Record<string, unknown> | null;
  const review = meta?.sourceReview as { sourceUrl?: string; notes?: string; checkedAt?: string; status?: string } | undefined;
  const reviewedUrl = safeUrl(review?.sourceUrl);
  const research = robot.contributions.filter(c => c.contributionType === 'research_paper' && safeUrl(c.sourceUrl));
  return <section style={{maxWidth:900,overflowWrap:'anywhere'}}>
    <Link href={chosen.task ? `/match?industry=${chosen.industry!.id}&task=${query.task}&other=${encodeURIComponent(query.other || '')}` : '/robots'}>{chosen.task ? 'Back to results / กลับผลการค้นหา' : 'Robot registry / ทะเบียนหุ่นยนต์'}</Link>
    <h1>{robot.canonicalName}</h1><p>{robot.manufacturer || robot.developerOrg || 'Unknown developer'}</p>
    <FavoriteButton robotId={robot.id} name={robot.canonicalName}/>
    <RobotSourceImage url={getRobotSourceImage(robot, [])} name={robot.canonicalName} sourceMeta={robot.sourceMeta}/>
    <p>{robot.description || 'No description available.'}</p><p>Type: {robot.robotType}</p>
    <h2>Capabilities & evidence / ความสามารถและหลักฐาน</h2>
    <p>No structured, verified capability specifications are available. Existing descriptions and use cases are registry information, not independent validation.</p>
    {chosen.task && <><h3>{chosen.task.name}</h3><ul>{chosen.task.requirements.map(r=><li key={r}>{r}: Not verified / ยังไม่ยืนยัน</li>)}</ul><p>This robot was opened from the registry, not recommended as a verified match.</p></>}
    <h2>Sources / แหล่งข้อมูล</h2>{url ? <a href={url} target="_blank" rel="noopener noreferrer">Existing registry reference — source claims not independently verified</a> : <p>No usable source URL documented.</p>}
    {review && <div className="notice"><p>Source review: {review.status} · {review.checkedAt?.slice(0, 10)}</p><p>{review.notes}</p>{reviewedUrl && <a href={reviewedUrl} target="_blank" rel="noopener noreferrer">ต้นฉบับที่ใช้ตรวจสอบ</a>}</div>}
    <h2>Related research / งานวิจัยที่เชื่อมโยง</h2>
    {research.length ? research.map(c=><article key={c.id}><h3>{c.title}</h3><p>{c.contributorName || 'Authors not documented'}</p><p>{c.description}</p><p>Review status: {c.verificationStatus}. Linked by the existing registry relationship; does not establish task suitability.</p><a href={safeUrl(c.sourceUrl)!} target="_blank" rel="noopener noreferrer">Research source</a></article>) : <p>No research with a usable source link is connected to this robot. Seed placeholders are excluded.</p>}
    <h2>Limitations & unknowns / ข้อมูลที่ยังไม่ยืนยัน</h2><p>Technical specifications, task suitability and practical limitations have not been verified in the available records. Missing information is not proof of a missing capability.</p>
  </section>;
}
