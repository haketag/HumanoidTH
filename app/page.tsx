import { Suspense } from "react";
import { ArrowDown } from "lucide-react";
import { cookies } from "next/headers";
import { getTranslation } from "@/lib/translations";
import { verifyAdminSessionToken } from "@/lib/admin-session";
import CorpusOverview from "./components/CorpusOverview";
import RobotViewer from "./components/RobotViewer";
import styles from "./home.module.css";

export default async function HomePage() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("lang")?.value === "th" ? "th" : "en";
  const thai = lang === "th";
  const t = getTranslation(lang);
  const isAdmin = await verifyAdminSessionToken(cookieStore.get("admin_session")?.value, process.env.ADMIN_SESSION_SECRET);

  return (
    <main id="main-content" tabIndex={-1} className={styles.content}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <h1 id="home-title">
            {thai ? <><span>แผนที่หุ่นยนต์</span><span>ฮิวแมนนอยด์ไทย</span></> : <><span>Thailand</span><span>Humanoid Atlas</span></>}
          </h1>
          <p>{thai ? "สำรวจระบบนิเวศหุ่นยนต์ในประเทศไทย" : "Explore Thailand’s robotics ecosystem."}</p>
          <a href="#overview" className={styles.heroLink}>
            {thai ? "สำรวจคลังข้อมูล" : "Explore the atlas"}
            <ArrowDown size={19} aria-hidden="true" />
          </a>
        </div>
        <div className={styles.robotStage}>
          <RobotViewer lang={lang} />
        </div>
      </section>

      <section id="overview" tabIndex={-1} className={styles.overview} aria-labelledby="overview-title">
        <header className={styles.overviewHeading}>
          <h2 id="overview-title">{t.overview}</h2>
          <p>{thai ? "ข้อมูลหุ่นยนต์และงานวิจัยในประเทศไทย" : "Robots and research in Thailand."}</p>
        </header>
        <Suspense fallback={<p role="status" className={styles.overviewStatus}>{thai ? "กำลังโหลดข้อมูลภาพรวม…" : "Loading corpus overview…"}</p>}>
          <CorpusOverview lang={lang} isAdmin={isAdmin} />
        </Suspense>
      </section>
    </main>
  );
}
