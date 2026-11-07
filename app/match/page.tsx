import Link from 'next/link';
import { cookies } from 'next/headers';
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Factory, GraduationCap, HeartPulse, Hotel } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { industries, tasks, selection, matchRobot } from '@/lib/humanoid-match';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Humanoid Match' };

const icons = [HeartPulse, Factory, Hotel, GraduationCap];
const thaiRequirements: Record<string, string> = {
  'Human interaction': 'โต้ตอบกับคน',
  'Speech / communication': 'สื่อสารด้วยเสียง',
  'Indoor navigation': 'นำทางในอาคาร',
  'Activity facilitation': 'ช่วยจัดกิจกรรม',
  Manipulation: 'ควบคุมแขนและมือ',
  'Object handling': 'หยิบจับสิ่งของ',
  'Payload / transport': 'รับน้ำหนักและขนส่ง',
  Perception: 'รับรู้สภาพแวดล้อม',
  Sensors: 'เซนเซอร์',
  Mobility: 'เคลื่อนที่',
  Programmability: 'เขียนโปรแกรมได้',
  'Information interface': 'แสดงข้อมูลให้ผู้ใช้',
  'Research interfaces': 'เชื่อมต่อเครื่องมือวิจัย',
};

export default async function MatchPage({ searchParams }: { searchParams: Promise<{ industry?: string; task?: string; other?: string }> }) {
  const params = await searchParams;
  const th = (await cookies()).get('lang')?.value === 'th';
  const { industry, task } = selection(params.industry, params.task, params.other);
  const custom = params.task === 'other';
  const other = typeof params.other === 'string' ? params.other.slice(0, 300) : '';
  const step = task ? 3 : industry ? 2 : 1;
  const taskUrl = industry ? `/match?industry=${industry.id}#match-step` : '/match';
  const steps = [
    { label: th ? 'อุตสาหกรรม' : 'Industry', href: '/match#match-step' },
    { label: th ? 'ลักษณะงาน' : 'Task', href: taskUrl },
    { label: th ? 'ผลการจับคู่' : 'Results' },
  ];

  let candidates: Awaited<ReturnType<typeof prisma.robotModel.findMany>> = [];
  let failed = false;
  if (task && !custom) {
    try {
      const robots = await prisma.robotModel.findMany({ orderBy: { canonicalName: 'asc' } });
      candidates = robots.filter(robot => matchRobot(robot, task.requirements).supported);
    } catch {
      failed = true;
    }
  }

  return (
    <section className={styles.root} aria-labelledby="match-title">
      <header className={styles.intro}>
        <h1 id="match-title">Humanoid Match</h1>
        <p>{th ? 'เลือกอุตสาหกรรมและลักษณะงาน เพื่อดูว่ามีหุ่นยนต์รุ่นใดที่มีหลักฐานรองรับ' : 'Choose an industry and a task to find robots with documented capabilities for the job.'}</p>
      </header>

      <nav aria-label={th ? 'ขั้นตอนการจับคู่' : 'Matching steps'} className={styles.progress}>
        <ol>
          {steps.map(({ label, href }, index) => {
            const complete = index + 1 < step;
            const content = <><span className={styles.number}>{complete ? <Check size={15} aria-hidden="true" /> : index + 1}</span>{label}</>;
            return (
              <li key={label} data-complete={complete} aria-current={index + 1 === step ? 'step' : undefined}>
                {complete && href ? <Link href={href}>{content}</Link> : <span>{content}</span>}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className={styles.stage} aria-labelledby="match-step">
        {industry && (
          <div className={styles.context}>
            <Link href={task ? taskUrl : '/match#match-step'}><ArrowLeft size={16} aria-hidden="true" />{task ? (th ? 'กลับไปเลือกลักษณะงาน' : 'Back to tasks') : (th ? 'กลับไปเลือกอุตสาหกรรม' : 'Back to industries')}</Link>
            <span>{th ? industry.th : industry.name}</span>
          </div>
        )}
        <h2 id="match-step" tabIndex={-1}>{task ? (th ? 'ผลการจับคู่' : 'Matching results') : industry ? (th ? 'อยากให้หุ่นยนต์ช่วยงานอะไร?' : 'What should the robot help with?') : (th ? 'คุณทำงานในอุตสาหกรรมไหน?' : 'Which industry are you working in?')}</h2>

        {!industry && (
          <>
            <p className={styles.helper}>{th ? 'เลือกกลุ่มที่ใกล้เคียงกับงานของคุณที่สุด' : 'Choose the sector that best fits your work.'}</p>
            <ul className={`${styles.choices} ${styles.industryChoices}`}>
              {industries.map((item, index) => {
                const Icon = icons[index];
                const examples = item.tasks.map(id => th ? tasks[id].th : tasks[id].name);
                return (
                  <li key={item.id}>
                    <Link href={`/match?industry=${item.id}#match-step`} className={styles.choice}>
                      <span className={styles.icon}><Icon size={21} aria-hidden="true" /></span>
                      <span className={styles.choiceText}>
                        <strong>{th ? item.th : item.name}</strong>
                        <small>{examples.join(' · ')}</small>
                      </span>
                      <ArrowRight className={styles.arrow} size={18} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {industry && !task && (
          <>
            <p className={styles.helper}>{th ? 'เลือกหนึ่งงานเพื่อดูผลการจับคู่' : 'Select one task to see the results.'}</p>
            <ul className={styles.choices}>
              {industry.tasks.map(id => (
                <li key={id}>
                  <Link className={styles.choice} href={`/match?industry=${industry.id}&task=${id}#match-step`}>
                    <span className={styles.choiceText}>
                      <strong>{th ? tasks[id].th : tasks[id].name}</strong>
                      <small>{tasks[id].requirements.map(requirement => th ? thaiRequirements[requirement] : requirement).join(' · ')}</small>
                    </span>
                    <ArrowRight className={styles.arrow} size={18} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <details className={styles.custom} open={custom || undefined}>
              <summary><span><CircleHelp size={18} aria-hidden="true" />{th ? 'ระบุงานอื่น' : 'Describe a different task'}</span><ChevronDown size={18} aria-hidden="true" /></summary>
              <form action="/match#match-step" method="get">
                <input type="hidden" name="industry" value={industry.id} />
                <input type="hidden" name="task" value="other" />
                <label htmlFor="other-task">{th ? 'อธิบายงานที่ต้องการ' : 'Describe the task'}</label>
                <textarea id="other-task" name="other" defaultValue={other} required maxLength={300} rows={3} aria-describedby="other-help" />
                <p id="other-help">{th ? 'ไม่เกิน 300 ตัวอักษร ระบบจะแสดงงานที่คุณระบุไว้ การจับคู่อัตโนมัติรองรับเฉพาะงานในรายการ' : 'Up to 300 characters. You can review your description. Automatic matching is available for listed tasks.'}</p>
                {custom && <p role="alert">{th ? 'กรุณาพิมพ์รายละเอียดงานอย่างน้อย 1 ตัวอักษร' : 'Enter at least one character other than a space.'}</p>}
                <button className={styles.action} type="submit">{th ? 'ดูสรุปงาน' : 'Review task'}<ArrowRight size={16} aria-hidden="true" /></button>
              </form>
            </details>
          </>
        )}

        {industry && task && (
          <>
            <p className={styles.selectedTask}>{th ? task.th : task.name}</p>
            {task.requirements.length > 0 && (
              <div className={styles.requirements}>
                <h3>{th ? 'ความสามารถที่งานต้องการ' : 'Required capabilities'}</h3>
                <ul>{task.requirements.map(requirement => <li key={requirement}>{th ? thaiRequirements[requirement] : requirement}</li>)}</ul>
              </div>
            )}
            {failed ? (
              <div className={styles.outcome} role="alert">
                <h3>{th ? 'โหลดผลการจับคู่ไม่ได้' : 'Could not load results'}</h3>
                <p>{th ? 'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่ภายหลัง' : 'The database is unavailable. Please try again later.'}</p>
              </div>
            ) : candidates.length > 0 ? (
              <ul className={styles.choices}>
                {candidates.map(robot => (
                  <li key={robot.id}>
                    <Link className={styles.choice} href={`/robots/${encodeURIComponent(robot.id)}?industry=${industry.id}&task=${params.task}`}>
                      <span className={styles.choiceText}>
                        <strong>{robot.canonicalName}</strong>
                        <small>{robot.manufacturer || robot.developerOrg || (th ? 'ไม่ทราบผู้พัฒนา' : 'Unknown developer')}</small>
                      </span>
                      <ArrowRight className={styles.arrow} size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.outcome}>
                <h3>{custom ? (th ? 'สรุปงานที่คุณระบุ' : 'Your custom task') : (th ? 'ยังไม่มีผลจับคู่ที่ยืนยันได้' : 'No verified matches yet')}</h3>
                <p>{custom ? (th ? 'งานนี้ยังไม่มีเกณฑ์สำหรับจับคู่อัตโนมัติ คุณเลือกงานจากรายการหรือเปิดดูทะเบียนหุ่นยนต์ได้' : 'This task has no matching criteria yet. Choose a listed task or explore the robot registry.') : (th ? 'ข้อมูลที่มีอยู่ยังไม่พอที่จะยืนยันว่าหุ่นยนต์รุ่นใดมีความสามารถครบตามงานนี้' : 'The available evidence is insufficient to verify that any robot meets all the requirements for this task.')}</p>
                <Link className={styles.action} href="/robots">{th ? 'สำรวจทะเบียนหุ่นยนต์' : 'Explore the robot registry'}<ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            )}
          </>
        )}
      </section>
    </section>
  );
}
