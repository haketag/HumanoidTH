import { prisma } from '@/lib/prisma';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ArrowUpRight, Bot, BookOpen, FileText, ImageIcon, Network, ShieldCheck } from 'lucide-react';
import { groupRobotTypes, share, type CountRow } from '@/lib/dashboard';
import { getRobotImageCredit, getRobotSourceImage } from '@/lib/robot-images';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ภาพรวมหุ่นยนต์ที่เกี่ยวข้องกับไทย | Robotics Dashboard', description: 'สำรวจรุ่นหุ่นยนต์ การใช้งาน และแหล่งข้อมูลที่รวบรวมไว้ พร้อมข้อจำกัดที่ควรรู้ก่อนนำข้อมูลไปใช้', alternates: { canonical: '/dashboard' } };

function Bars({ rows, empty, unit }: { rows: CountRow[]; empty: string; unit: string }) {
  const max = Math.max(1, ...rows.map(row => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows.length ? <ul className={styles.bars}>{rows.map(row => <li key={row.label}>
    <span className={styles.barLabel}>{row.label}</span>
    <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${share(row.count, max)}%` }} /></span>
    <span className={styles.barValue}>{row.count.toLocaleString()}<small>{unit} · {share(row.count, total).toFixed(1)}%</small></span>
  </li>)}</ul> : <p className={styles.empty}>{empty}</p>;
}

export default async function DashboardPage() {
  const thai = (await cookies()).get('lang')?.value === 'th';
  const text = (th: string, en: string) => thai ? th : en;
  const countRows = <K extends string>(rows: ({ _count: { _all: number } } & Record<K, string | null>)[], key: K, labels: Record<string, string> = {}): CountRow[] => rows.map(row => ({ label: labels[row[key] || ''] || row[key]?.replace(/_/g, ' ') || text('ยังไม่ระบุ', 'Not recorded'), count: row._count._all })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  let data;
  try {
    const [locations, robotTypes, sourceTypes, embodimentLevels, contributionTypes, themes, highConfidenceAnn, medConfidenceAnn, lowConfidenceAnn, highConfidenceSrc, medConfidenceSrc, lowConfidenceSrc, robots] = await Promise.all([
      prisma.robotModel.groupBy({ by: ['countryOfOrigin'], _count: { _all: true } }),
      prisma.robotModel.groupBy({ by: ['robotType'], _count: { _all: true } }),
      prisma.sourceRecord.groupBy({ by: ['sourceType'], _count: { _all: true } }),
      prisma.robotModel.groupBy({ by: ['embodimentLevel'], _count: { _all: true } }),
      prisma.contribution.groupBy({ by: ['contributionType'], _count: { _all: true } }),
      prisma.perspectiveAnnotation.groupBy({ by: ['perspectiveTheme'], _count: { _all: true } }),
      prisma.perspectiveAnnotation.count({ where: { confidence: { gte: 0.8 } } }),
      prisma.perspectiveAnnotation.count({ where: { confidence: { gte: 0.5, lt: 0.8 } } }),
      prisma.perspectiveAnnotation.count({ where: { confidence: { lt: 0.5 } } }),
      prisma.sourceRecord.count({ where: { relevanceConfidence: { gte: 0.8 } } }),
      prisma.sourceRecord.count({ where: { relevanceConfidence: { gte: 0.5, lt: 0.8 } } }),
      prisma.sourceRecord.count({ where: { relevanceConfidence: { lt: 0.5 } } }),
      prisma.robotModel.findMany({ select: { canonicalName: true, officialUrl: true, sourceMeta: true } }),
    ]);
    data = { locations, robotTypes, sourceTypes, embodimentLevels, contributionTypes, themes, highConfidenceAnn, medConfidenceAnn, lowConfidenceAnn, highConfidenceSrc, medConfidenceSrc, lowConfidenceSrc, robots };
  } catch (error) { console.error('Database query failed in dashboard:', error); }
  const totalRobots = data?.robots.length || 0;
  const totalSources = data?.sourceTypes.reduce((sum, row) => sum + row._count._all, 0) || 0;
  const withImages = data?.robots.filter(robot => getRobotImageCredit(robot.sourceMeta) && getRobotSourceImage(robot, [])).length || 0;
  const sourceLabels: Record<string, string> = { WEB: text('หน้าเว็บและบทความออนไลน์', 'Web pages & online articles'), OPENALEX: text('ระเบียนวิชาการจาก OpenAlex', 'Scholarly records from OpenAlex'), GITHUB: text('โครงการบน GitHub', 'GitHub projects'), YOUTUBE: text('วิดีโอจาก YouTube', 'YouTube videos'), GDELT: text('ข่าวจาก GDELT', 'News from GDELT') };
  const empty = data ? text('ยังไม่มีข้อมูลในหมวดนี้', 'No records in this category yet.') : text('ยังแสดงข้อมูลไม่ได้ กรุณาลองใหม่ภายหลัง', 'Data unavailable. Please try again later.');
  const unit = text('รายการ', 'records');
  const confidence = (high: number, medium: number, low: number): CountRow[] => [
    { label: text('คะแนนสูง (ตั้งแต่ 0.8)', 'High score (0.8 or more)'), count: high },
    { label: text('คะแนนกลาง (0.5–ต่ำกว่า 0.8)', 'Medium score (0.5–under 0.8)'), count: medium },
    { label: text('คะแนนต่ำ (ต่ำกว่า 0.5)', 'Low score (under 0.5)'), count: low },
  ];
  const details = data ? [
    { title: text('ประเทศต้นกำเนิดหุ่นยนต์', 'Robot countries of origin'), note: text('ประเทศของผู้พัฒนาหรือผู้ผลิต ไม่ใช่ตำแหน่งที่หุ่นยนต์ใช้งานอยู่', 'Origin of the developer or manufacturer, not deployment locations.'), rows: countRows(data.locations, 'countryOfOrigin', thai ? { Thailand: 'ไทย', China: 'จีน', Japan: 'ญี่ปุ่น', France: 'ฝรั่งเศส' } : {}) },
    { title: text('ประเภทตามทะเบียนเดิม', 'Original registry types'), note: text('รายละเอียดประเภททั้งหมดก่อนรวมเป็นกลุ่มด้านบน', 'All original categories before the display groups above.'), rows: countRows(data.robotTypes, 'robotType') },
    { title: text('รูปร่างและรูปแบบของหุ่นยนต์', 'Robot forms'), note: text('เช่น หุ่นยนต์เคลื่อนที่ แบบตั้งโต๊ะ หรืออุปกรณ์สวมใส่', 'Includes mobile, desktop and wearable platforms.'), rows: countRows(data.embodimentLevels, 'embodimentLevel') },
    { title: text('ผลงานที่บันทึกไว้', 'Recorded contributions'), note: text('รวมโครงการและบทความ สถานะการตรวจสอบของแต่ละรายการอาจต่างกัน', 'Includes projects and papers with different review statuses.'), rows: countRows(data.contributionTypes, 'contributionType', thai ? { research_paper: 'บทความวิจัย', education_robotics_project: 'โครงการหุ่นยนต์เพื่อการศึกษา', education_capacity_building_program: 'โครงการพัฒนาทักษะ', community_healthcare_robotics_project: 'โครงการสุขภาพชุมชน' } : {}) },
    { title: text('ประเด็นที่พบในบทวิเคราะห์', 'Topics in source annotations'), note: text('นับจากข้อความที่บันทึกไว้ ไม่ใช่ผลสำรวจความคิดเห็นของคนไทยทั้งหมด', 'Counts recorded annotations, not a representative public opinion survey.'), rows: countRows(data.themes, 'perspectiveTheme', thai ? { public_safety_and_surveillance: 'ความปลอดภัยและการเฝ้าระวัง', quality_of_life_and_service_robotics: 'คุณภาพชีวิตและหุ่นยนต์บริการ', elderly_care_safety: 'ความปลอดภัยในการดูแลผู้สูงอายุ', industrial_market_opportunity: 'โอกาสในภาคอุตสาหกรรม' } : {}) },
    { title: text('คะแนนคัดกรองแหล่งข้อมูล', 'Source relevance scores'), note: text('คะแนนว่าข้อมูลเกี่ยวข้องกับหัวข้อเพียงใด ไม่ใช่คะแนนความถูกต้อง', 'How relevant a source is to the topic, not how factually accurate it is.'), rows: confidence(data.highConfidenceSrc, data.medConfidenceSrc, data.lowConfidenceSrc) },
    { title: text('คะแนนการวิเคราะห์ข้อความ', 'Annotation confidence scores'), note: text('ความมั่นใจของระบบในการวิเคราะห์ข้อความ ไม่ใช่การยืนยันข้อเท็จจริง', 'System confidence in interpreting text, not factual verification.'), rows: confidence(data.highConfidenceAnn, data.medConfidenceAnn, data.lowConfidenceAnn) },
  ] : [];
  return <div className={styles.dashboard} lang={thai ? 'th' : 'en'}>
    <div className={styles.breadcrumb}><Link href="/">{text('ภาพรวม', 'Overview')}</Link><span>/</span><span>{text('แดชบอร์ด', 'Dashboard')}</span></div>
    <header className={styles.header}><div><h1>{text('รู้จักหุ่นยนต์ที่เกี่ยวข้องกับไทย', 'Explore robots connected to Thailand')}</h1><p>{text('ดูว่ามีรุ่นไหน ใช้ทำอะไร และมีข้อมูลจากที่ใดให้ตรวจสอบต่อ', 'See which models are recorded, what they are used for and where to learn more.')}</p></div><Link className={styles.sourceButton} href="/database"><FileText size={16} aria-hidden="true" />{text('ดูแหล่งข้อมูล', 'Browse sources')}</Link></header>
    {!data && <div className={styles.offline} role="alert">{text('เชื่อมต่อฐานข้อมูลไม่ได้ในขณะนี้ จึงยังแสดงยอดจริงไม่ได้ ลองโหลดหน้านี้ใหม่อีกครั้ง', 'The database is unavailable. Live totals cannot be shown. Please reload to try again.')}</div>}
    <div className={styles.summary}>
      <dl><dt>{text('รุ่นที่รวบรวมไว้', 'Recorded robot models')}</dt><dd>{data ? totalRobots.toLocaleString() : '—'}</dd></dl>
      <dl><dt>{text('แหล่งข้อมูลในระบบ', 'Source records')}</dt><dd>{data ? totalSources.toLocaleString() : '—'}</dd></dl>
      <dl><dt>{text('รุ่นที่มีภาพพร้อมที่มา', 'Models with credited images')}</dt><dd>{data ? `${withImages}/${totalRobots}` : '—'}</dd></dl>
      <Link href="/robots">{text('สำรวจหุ่นยนต์ทั้งหมด', 'Explore the registry')}<ArrowUpRight size={18} aria-hidden="true" /></Link>
    </div>
    <p className={styles.scope}>{text('นับเฉพาะข้อมูลที่รวบรวมไว้ในเว็บนี้ ไม่ใช่จำนวนหุ่นยนต์ทั้งหมดที่ใช้งานในประเทศไทย', 'These totals describe this website’s records, not all robots deployed in Thailand.')}</p>
    <div className={styles.grid}>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{text('หุ่นยนต์เหล่านี้ใช้ทำอะไร', 'What are these robots used for?')}</h2><p>{text('จัดกลุ่มตามประเภทที่บันทึกไว้ในทะเบียน', 'Grouped by the types recorded in the registry.')}</p></div><Bot size={21} aria-hidden="true" /></div><Bars rows={groupRobotTypes(data?.robotTypes || [], thai)} empty={empty} unit={text('รุ่น', 'models')} /><p className={styles.footnote}>{text('บางรุ่นยังเป็นต้นแบบ การอยู่ในกลุ่มนี้ไม่ได้ยืนยันว่าทำงานได้ตามที่ระบุทุกข้อ', 'Some models are prototypes. A category does not verify every claimed capability.')}</p></section>
      <section className={styles.panel}><h2>{text('อ่านข้อมูลนี้อย่างไร', 'How to read these records')}</h2><p className={styles.sectionIntro}>{text('แยกสิ่งที่มีแหล่งอ้างอิง ออกจากสิ่งที่ยังต้องตรวจสอบ', 'Distinguish sourced information from claims that still need checking.')}</p><ul className={styles.guidance}>
        <li><BookOpen size={24} aria-hidden="true" /><div><h3>{text('ข่าวโครงการ ≠ งานวิจัย', 'Project news ≠ research')}</h3><p>{text('ข่าวบอกว่าโครงการทำอะไร ส่วนบทความวิจัยจึงค่อยดูวิธีทดสอบและผลที่รายงาน', 'Project news describes an initiative. Research papers document methods and results.')}</p></div></li>
        <li><ImageIcon size={24} aria-hidden="true" /><div><h3>{text('ดูรูปแล้วตามไปยังต้นทางได้', 'Follow images to their source')}</h3><p>{text('ภาพที่มีเครดิตช่วยให้ตรวจชื่อรุ่นและบริบทได้ แต่ไม่ได้รับรองความสามารถ', 'Credits help check model identity and context, not performance.')}</p></div></li>
        <li><ShieldCheck size={24} aria-hidden="true" /><div><h3>{text('ยังไม่มีข้อมูล ไม่ได้แปลว่าทำไม่ได้', 'Missing evidence is not inability')}</h3><p>{text('ถ้ายังไม่มีหลักฐานเพียงพอ เราจะระบุว่ายังไม่ยืนยัน แทนการสรุปแทนผู้อ่าน', 'When evidence is insufficient, the claim remains unverified.')}</p></div></li>
      </ul><p className={styles.footnote}>{text('ตรวจแหล่งที่มาแล้ว ≠ รับรองประสิทธิภาพหรือความปลอดภัยแล้ว', 'Source checked ≠ performance or safety certified')}</p></section>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{text('ข้อมูลมาจากไหน', 'Where does the data come from?')}</h2><p>{text('นับตามชนิดระเบียนที่ระบบเก็บไว้', 'Counts by the source record type stored in the system.')}</p></div><FileText size={21} aria-hidden="true" /></div><Bars rows={data ? countRows(data.sourceTypes, 'sourceType', sourceLabels) : []} empty={empty} unit={unit} /><p className={styles.footnote}>{text('หน้าเว็บอาจเป็นข่าวหรือหน้าโครงการ จึงไม่ควรนับทั้งหมดเป็นงานวิจัย', 'Web records can include news and project pages; they are not all research papers.')}</p></section>
      <section className={styles.explore}><h2>{text('อยากรู้เรื่องไหนต่อ', 'Where would you like to go next?')}</h2>{[
        { href: '/robots', title: text('ดูหุ่นยนต์แต่ละรุ่น', 'Explore robot models'), description: text('รูป ผู้พัฒนา การใช้งาน และแหล่งอ้างอิง', 'Images, developers, use cases and source links'), icon: Bot },
        { href: '/contributions', title: text('ดูงานวิจัยและโครงการ', 'Browse papers and projects'), description: text('อ่านผลงานที่เชื่อมโยงกับหุ่นยนต์', 'Read contributions connected to the registry'), icon: BookOpen },
        { href: '/network', title: text('ดูว่าใครเกี่ยวข้องกับใคร', 'Explore connections'), description: text('สำรวจความเชื่อมโยงที่มีบันทึกในระบบ', 'Explore relationships recorded in the database'), icon: Network },
      ].map(item => <Link key={item.href} href={item.href}><item.icon size={24} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowUpRight size={18} aria-hidden="true" /></Link>)}</section>
    </div>
    <section className={styles.details} aria-labelledby="dashboard-details"><h2 id="dashboard-details">{text('ดูรายละเอียดของข้อมูล', 'Explore the data in detail')}</h2><p>{text('กดหัวข้อที่สนใจ เพื่อดูการแบ่งประเภทและคะแนนทั้งหมด', 'Expand a topic to see the original categories and score distributions.')}</p>{details.map(item => <details key={item.title}><summary>{item.title}</summary><div className={styles.detailBody}><p>{item.note}</p><Bars rows={item.rows} empty={empty} unit={unit} /></div></details>)}</section>
  </div>;
}
