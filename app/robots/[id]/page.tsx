import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ExternalLink, ArrowLeft, Building2, BookOpen } from 'lucide-react';
import FavoriteButton from '../../components/FavoriteButton';
import RobotSourceImage from '../../components/RobotSourceImage';
import { getRobotSourceImage } from '@/lib/robot-images';
import { robotProfile } from '@/lib/robot-profile';
import { getPublicImageSources } from '@/lib/public-source-cache';
import { prisma } from '@/lib/prisma';
import { safeUrl, selection } from '@/lib/humanoid-match';
import '../robots.css';

export const dynamic = 'force-dynamic';

export default async function RobotDetail({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ industry?: string; task?: string; other?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const chosen = selection(query.industry, query.task, query.other);
  const th = (await cookies()).get('lang')?.value === 'th';
  let robot;
  let sources;
  try {
    [robot, sources] = await Promise.all([
      prisma.robotModel.findUnique({ where: { id }, include: { contributions: { where: { visibility: 'public' } } } }),
      getPublicImageSources()
    ]);
  } catch {
    return <p role="alert">{th ? 'โหลดข้อมูลไม่ได้ กรุณาลองอีกครั้ง' : 'Database unavailable. Please try again.'} <Link href="/robots">{th ? 'คลังหุ่นยนต์' : 'Robot registry'}</Link></p>;
  }
  if (!robot) notFound();
  const profile = robotProfile(robot.sourceMeta, robot.officialUrl);
  const research = robot.contributions.filter(c => c.contributionType === 'research_paper' && safeUrl(c.sourceUrl));
  const backUrl = chosen.task ? `/match?industry=${chosen.industry!.id}&task=${query.task}&other=${encodeURIComponent(query.other || '')}` : '/robots';
  const developer = robot.developerOrg || robot.manufacturer;

  return <article className="robot-detail">
    <Link className="robot-back" href={backUrl}><ArrowLeft size={16} aria-hidden="true" />{chosen.task ? (th ? 'กลับผลการค้นหา' : 'Back to results') : (th ? 'คลังหุ่นยนต์' : 'Robot registry')}</Link>
    <header className="robot-detail-header">
      <div><p className="muted">{developer || (th ? 'ยังไม่ระบุผู้พัฒนา' : 'Developer not documented')}</p><h1>{robot.canonicalName}</h1></div>
      <FavoriteButton robotId={robot.id} name={robot.canonicalName} />
    </header>
    <div className="robot-detail-hero">
      <div className="robot-detail-image"><RobotSourceImage url={getRobotSourceImage(robot, sources)} name={robot.canonicalName} sourceMeta={robot.sourceMeta} /></div>
      <section className="robot-detail-summary">
        <h2>{th ? 'รู้จักหุ่นยนต์ตัวนี้' : 'About this robot'}</h2>
        <p>{th ? profile.descriptionTh || robot.description || 'ยังไม่มีรายละเอียด' : robot.description || 'No description available.'}</p>
        <dl className="robot-facts">
          <div><dt>{th ? 'ประเภท' : 'Type'}</dt><dd>{robot.robotType.replaceAll('_', ' ')}</dd></div>
          <div><dt>{th ? 'ผู้ผลิต / ผู้พัฒนาในคลัง' : 'Manufacturer / developer in registry'}</dt><dd>{developer || (th ? 'ยังไม่ระบุ' : 'Not documented')}</dd></div>
        </dl>
        {profile.sourceUrl && <a className="button primary robot-source-button" href={profile.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} aria-hidden="true" />{th ? 'เปิดเอกสารต้นทาง' : 'Open original source'}</a>}
        <Link className="button" href={`/research-assistant?robotId=${encodeURIComponent(robot.id)}&q=${encodeURIComponent(th ? 'หุ่นตัวนี้มีข้อมูลการใช้งานและข้อจำกัดอะไรบ้าง' : 'What uses and limitations are documented for this robot?')}`}>{th ? 'ถาม Pet AI เกี่ยวกับหุ่นตัวนี้' : 'Ask Pet AI about this robot'}</Link>
        <p className="muted robot-source-hint">{th ? 'เปิดบทความโครงการ งานวิจัย หรือหน้าผลิตภัณฑ์ในแท็บใหม่' : 'Opens the project article, research paper or product page in a new tab.'}</p>
      </section>
    </div>

    <section className="robot-detail-section" id="research">
      <h2><BookOpen size={22} aria-hidden="true" />{th ? 'งานวิจัยและเอกสารโครงการ' : 'Research & project documents'}</h2>
      {research.map(paper => <article className="robot-research" key={paper.id}>
        <p className="muted">{th ? 'งานวิจัยที่เชื่อมโยง' : 'Linked research paper'}</p>
        <h3>{paper.title}</h3><p>{paper.contributorName}</p><p>{paper.description}</p>
        <a className="button" href={safeUrl(paper.sourceUrl)!} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true" />{th ? 'อ่านงานวิจัยต้นฉบับ' : 'Read original paper'}</a>
      </article>)}
      {profile.sourceUrl && <div className="robot-research">
        <h3>{th ? 'เอกสารต้นทางของรายการนี้' : 'Original registry reference'}</h3>
        <p className="muted">{th ? 'ข้อมูลจากผู้พัฒนา มหาวิทยาลัย หรือหน่วยงานที่รายงานโครงการ โดยเอกสารอาจเป็นหน้าผลิตภัณฑ์หรือบทความโครงการ' : 'A manufacturer, university or project report. The source may be a product page or project article.'}</p>
        <a className="button" href={profile.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true" />{th ? 'อ่านเอกสารต้นทาง' : 'Read source document'}</a>
      </div>}
      {!research.length && <p className="muted">{th ? 'ยังไม่มีบทความวิจัยตีพิมพ์ที่ยืนยันความเชื่อมโยงกับรายการนี้ในคลัง อ่านเอกสารโครงการต้นทางด้านบนได้' : 'No publication with a confirmed link to this registry entry has been added yet. The original project reference is available above.'}</p>}
    </section>

    <section className="robot-detail-section">
      <h2>{th ? 'ความสามารถและข้อมูลที่ควรสอบถามเพิ่มเติม' : 'Capabilities & questions to follow up'}</h2>
      <p>{th ? 'ข้อมูลข้างต้นเป็นคำอธิบายจากแหล่งอ้างอิง ควรสอบถามผู้พัฒนาเรื่องรุ่นฮาร์ดแวร์ ข้อจำกัด สภาพแวดล้อมใช้งาน และการรับรองก่อนนำไปใช้จริง' : 'The descriptions reflect the cited sources. Ask the developer about hardware revision, limitations, operating conditions and certification before deployment.'}</p>
      {chosen.task && <><h3>{chosen.task.name}</h3><ul>{chosen.task.requirements.map(requirement => <li key={requirement}>{requirement}: {th ? 'ยังไม่มีผลตรวจยืนยัน' : 'Not verified'}</li>)}</ul><p>{th ? 'การเปิดจากผลค้นหาไม่ได้ยืนยันว่าหุ่นผ่านข้อกำหนดของงาน' : 'Opening this record does not verify suitability for the selected task.'}</p></>}
    </section>

    <footer className="robot-contact">
      <Building2 size={28} aria-hidden="true" />
      <div><h2>{th ? 'สนใจรายละเอียดเพิ่มเติม?' : 'Want to know more?'}</h2><p>{profile.contactName || developer || (th ? 'ผู้พัฒนาหุ่นยนต์' : 'Robot developer')}</p>
        <p className="muted">{th ? 'สอบถามข้อมูลรุ่น สเปก การใช้งาน และช่องทางความร่วมมือจากองค์กรต้นทาง' : 'Ask the original organization about specifications, deployment and collaboration.'}</p>
      </div>
      {profile.contactUrl ? <a className="button primary" href={profile.contactUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} aria-hidden="true" />{profile.contactKind === 'company' ? (th ? 'ติดต่อบริษัท' : 'Contact company') : profile.contactKind === 'institution' ? (th ? 'ติดต่อหน่วยงาน' : 'Contact organization') : (th ? 'เว็บไซต์ผู้พัฒนา' : 'Developer website')}</a> : <p className="muted">{th ? 'ยังไม่มีช่องทางติดต่อที่ยืนยันในคลัง' : 'No confirmed contact channel is documented yet.'}</p>}
    </footer>
  </article>;
}
