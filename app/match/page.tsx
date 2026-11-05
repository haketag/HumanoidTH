import Link from 'next/link';
import { cookies } from 'next/headers';
import { Bot, Factory, GraduationCap, HeartPulse, Hotel } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { industries, tasks, selection, matchRobot } from '@/lib/humanoid-match';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Humanoid Match' };
export default async function MatchPage({ searchParams }: { searchParams: Promise<{ industry?: string; task?: string; other?: string }> }) {
  const params = await searchParams;
  const th = (await cookies()).get('lang')?.value === 'th';
  const chosen = selection(params.industry, params.task, params.other);
  const other = typeof params.other === 'string' ? params.other.slice(0, 300) : '';
  const icons = [HeartPulse, Factory, Hotel, GraduationCap];
  let robots: Awaited<ReturnType<typeof prisma.robotModel.findMany>> = [];
  let failed = false;
  if (chosen.task) {
    try { robots = await prisma.robotModel.findMany({ orderBy: { canonicalName: 'asc' } }); }
    catch { failed = true; }
  }
  const candidates = chosen.task ? robots.filter(r => matchRobot(r, chosen.task!.requirements).supported) : [];
  return <section className={styles.root}>
    <h1>Humanoid Match</h1>
    <p className="muted">{th ? 'เริ่มจากงานที่คุณต้องการ แล้วสำรวจหุ่นยนต์และหลักฐานที่เกี่ยวข้อง' : 'Start with your work requirements. Explore robots and the evidence behind their capabilities.'}</p>
    <nav aria-label="Progress" className={styles.steps}>
      <Link href="/match" aria-current={!chosen.industry ? 'step' : undefined}>1. {th ? 'อุตสาหกรรม' : 'Industry'}</Link>
      <span aria-current={chosen.industry && !chosen.task ? 'step' : undefined}>2. {th ? 'ลักษณะงาน' : 'Task'}</span>
      <span aria-current={chosen.task ? 'step' : undefined}>3. {th ? 'ผลลัพธ์' : 'Results'}</span>
    </nav>
    {!chosen.industry ? <div className={styles.options}>{industries.map((i, index) => { const Icon = icons[index]; return <Link className={styles.option} key={i.id} href={`/match?industry=${i.id}`}><Icon size={24}/><h2>{th ? i.th : i.name}</h2><p>{i.tasks.map(t => th ? tasks[t].th : tasks[t].name).join(' / ')}</p></Link>; })}</div> : <>
      <Link href="/match">{th ? 'เปลี่ยนอุตสาหกรรม' : 'Change industry'}</Link>
      <h2>{th ? chosen.industry.th : chosen.industry.name}</h2>
      <form action="/match" method="get" className={styles.other}>
        <input type="hidden" name="industry" value={chosen.industry.id}/>
        <input type="hidden" name="task" value="other"/>
        <label htmlFor="other-task">{th ? 'อื่น ๆ (โปรดระบุ)' : 'Other (please specify)'}</label>
        <textarea id="other-task" name="other" defaultValue={other} required maxLength={300} rows={3} aria-describedby="other-help"/>
        <p id="other-help" className="muted">{th ? 'ระบุงานเพิ่มเติม ไม่เกิน 300 ตัวอักษร งานนี้ยังไม่มีข้อกำหนดความสามารถที่ตรวจสอบแล้ว และยังไม่ใช้จับคู่อัตโนมัติ' : 'Up to 300 characters. Custom tasks have no reviewed capability requirements and are not automatically matched.'}</p>
        <button className="button" type="submit">{th ? 'ใช้ลักษณะงานนี้' : 'Use this task'}</button>
        {params.task === 'other' && !chosen.task && <p role="alert">{th ? 'กรุณาระบุงาน 1–300 ตัวอักษร โดยไม่ใช้ช่องว่างอย่างเดียว' : 'Enter 1–300 characters, not just whitespace.'}</p>}
      </form>
      <div className={styles.options}>{chosen.industry.tasks.map(t => <Link className={styles.option} aria-current={params.task === t ? 'true' : undefined} key={t} href={`/match?industry=${chosen.industry!.id}&task=${t}`}><h3>{th ? tasks[t].th : tasks[t].name}</h3><p>{tasks[t].requirements.join(' / ')}</p></Link>)}</div>
    </>}
    {chosen.task && <section className={styles.results} aria-labelledby="results-title">
      <h2 id="results-title">{th ? 'ผลการค้นหาตามหลักฐาน' : 'Evidence-based results'}: {th ? chosen.task.th : chosen.task.name}</h2>
      <p>{th ? 'ข้อกำหนดของงาน ไม่ใช่การยืนยันความสามารถของหุ่นยนต์:' : 'Task requirements, not robot capability claims:'}</p>
      <ul>{chosen.task.requirements.map(r => <li key={r}>{r}</li>)}</ul>
      {params.task === 'other' && <p>{th ? 'งานที่ระบุเอง: ยังไม่ได้กำหนดหรือยืนยันข้อกำหนดความสามารถ' : 'Custom task: capability requirements have not been defined or verified.'}</p>}
      {failed ? <p role="alert">{th ? 'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่ภายหลัง' : 'Database unavailable. Please try again later.'}</p> : !robots.length ? <p>{th ? 'ยังไม่มีหุ่นยนต์ในฐานข้อมูล' : 'No robots available in the database.'}</p> : !candidates.length ? <div className="notice"><strong>{th ? 'หลักฐานความสามารถยังไม่เพียงพอ' : 'Insufficient capability evidence'}</strong><p>{th ? `มีข้อมูลหุ่นยนต์ ${robots.length} รุ่น แต่ยังไม่มีฟิลด์หลักฐานความสามารถที่ตรวจสอบได้ จึงยังไม่จัดรุ่นใดเป็นผลจับคู่ การไม่มีข้อมูลไม่ได้หมายความว่าหุ่นยนต์ทำงานนี้ไม่ได้` : `${robots.length} robot records are available, but the database has no structured capability evidence. No robot is presented as a match. Missing evidence does not mean a capability is absent.`}</p></div> : null}
{!failed && robots.length > 0 && <><h3>{th ? 'สำรวจทะเบียนเดิม — ยังไม่ใช่ผลจับคู่' : 'Explore the registry — these are not matches'}</h3><div className={styles.options}>{robots.map(r => <article className={styles.option} key={r.id}><Bot size={22}/><h3>{r.canonicalName}</h3><p>{r.manufacturer || r.developerOrg || (th ? 'ไม่ทราบผู้พัฒนา' : 'Unknown developer')}</p><p>{r.description || (th ? 'ยังไม่มีคำอธิบาย' : 'No description available.')}</p><p>{th ? 'ความสามารถที่ต้องการ: ยังไม่ยืนยัน' : 'Required capabilities: not verified'}</p><Link href={`/robots/${encodeURIComponent(r.id)}?industry=${chosen.industry!.id}&task=${params.task}&other=${encodeURIComponent(other)}`}>{th ? 'ดูรายละเอียดและแหล่งข้อมูล' : 'View robot details & sources'}</Link></article>)}</div></>}
      <p className="muted">{th ? 'เครื่องมือสำรวจข้อมูล ไม่ใช่การรับรองความเหมาะสม ความปลอดภัย หรือความพร้อมใช้งานจริง' : 'Discovery only. This does not certify suitability, safety, or deployment readiness.'}</p>
    </section>}
  </section>;
}
