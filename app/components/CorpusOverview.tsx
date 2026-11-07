import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getTranslation } from "@/lib/translations";
import CopyCommands from "./CopyCommands";
import styles from "../home.module.css";

const setupCommands = [
  "python -m humanoid_atlas db init",
  "python -m humanoid_atlas ingest seeds --file data/seeds/robot_models.seed.yml",
  "python -m humanoid_atlas ingest seeds --file data/seeds/inventory.seed.yml",
];

async function readCorpus(isAdmin: boolean) {
  const [sources, accepted, robots, contributions, inventory, platforms, dates, latestRun, pendingReviews] =
    await Promise.all([
      prisma.sourceRecord.count(),
      prisma.sourceRecord.count({ where: { relevanceStatus: "ACCEPTED" } }),
      prisma.robotModel.count(),
      prisma.contribution.count(),
      prisma.ownedInventory.count(),
      prisma.sourceRecord.groupBy({ by: ["platform"], _count: { _all: true } }),
      prisma.sourceRecord.aggregate({ _min: { publishedAt: true }, _max: { publishedAt: true } }),
      prisma.pipelineRun.findFirst({ orderBy: { startedAt: "desc" } }),
      isAdmin ? prisma.submittedData.count({ where: { status: { in: ["QUEUED", "NEEDS_REVIEW"] } } }) : null,
    ]);

  return { sources, accepted, robots, contributions, inventory, platforms, dates, latestRun, pendingReviews };
}

export default async function CorpusOverview({ lang, isAdmin }: { lang: "en" | "th"; isAdmin: boolean }) {
  const thai = lang === "th";
  const t = getTranslation(lang);
  const locale = thai ? "th-TH" : "en-US";
  const unavailable = thai ? "ไม่มีข้อมูล" : "Unavailable";
  const number = new Intl.NumberFormat(locale);
  const formatCount = (count?: number) => count === undefined ? unavailable : number.format(count);
  const data = await readCorpus(isAdmin).catch((error: unknown) => {
    console.error("Database connection failed in overview:", error);
    return null;
  });
  const platforms = data?.platforms
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 9) ?? [];
  const firstDate = data?.dates._min.publishedAt;
  const lastDate = data?.dates._max.publishedAt;
  const firstYear = firstDate?.getUTCFullYear();
  const lastYear = lastDate?.getUTCFullYear();
  const years = firstYear === lastYear ? firstYear : [firstYear, lastYear].filter(Boolean).join("–");
  const lastRun = data?.latestRun;
  const metrics = [
    { label: t.totalSources, count: data?.sources, note: (thai ? "อนุมัติแล้ว " : "Accepted ") + formatCount(data?.accepted) },
    { label: t.robotModels, count: data?.robots, note: null },
    { label: t.ownedUnits, count: data?.inventory, note: null },
    { label: t.contributors, count: data?.contributions, note: null },
  ];

  return (
    <>
      {!data && (
        <p className={styles.overviewStatus} role="status">
          {thai ? "เชื่อมต่อฐานข้อมูลไม่ได้ในขณะนี้" : "The database is currently unavailable."}
        </p>
      )}

      <dl className={styles.metrics}>
        {metrics.map(({ label, count, note }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={count === undefined ? styles.unavailable : styles.metricValue}>{formatCount(count)}</dd>
            {note && <dd className={styles.metricNote}>{note}</dd>}
          </div>
        ))}
      </dl>

      <dl className={styles.statusGrid}>
        <div>
          <dt>{t.pipelineStatus}</dt>
          <dd>{lastRun ? `${lastRun.pipelineName} · ${lastRun.status}` : data ? (thai ? "ยังไม่มีการประมวลผล" : "No pipeline runs") : unavailable}</dd>
          {lastRun?.finishedAt && <dd className={styles.metricNote}>
            {thai ? "ล่าสุด " : "Last run "}{lastRun.finishedAt.toLocaleDateString(locale, { timeZone: "Asia/Bangkok" })}
          </dd>}
        </div>
        <div>
          <dt>{t.temporalCoverage}</dt>
          <dd>{years ?? unavailable}</dd>
        </div>
      </dl>

      <details className={styles.platforms}>
        <summary>{thai ? "แหล่งข้อมูลตามแพลตฟอร์ม" : "Sources by platform"}</summary>
        {platforms.length ? (
          <dl>
            {platforms.map(({ platform, _count }) => (
              <div key={platform}>
                <dt>{platform || (thai ? "ไม่ระบุ" : "Unknown")}</dt>
                <dd>{formatCount(_count._all)}</dd>
              </div>
            ))}
          </dl>
        ) : <p className={styles.metricNote}>{data ? t.noPlatformRecords : unavailable}</p>}
      </details>

      <nav className={styles.featureLinks} aria-label={thai ? "ฟีเจอร์ของคลังข้อมูล" : "Atlas features"}>
        <Link href="/robots">{t.robots}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <Link href="/research-assistant">{thai ? "ผู้ช่วยวิจัย" : "Research Assistant"}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <Link href="/match">Humanoid Match<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </nav>

      <details className={styles.moreTools}>
        <summary>{thai ? "เครื่องมือเพิ่มเติม" : "More tools"}</summary>
        <nav className={styles.featureLinks} aria-label={thai ? "เครื่องมือเพิ่มเติม" : "More tools"}>
        <Link href="/companies">{thai ? "บริษัทและองค์กร" : "Companies"}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <Link href="/database" prefetch={false}>{t.browseDatabase}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        <Link href="/submit-data">{t.submitRecord}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        {isAdmin && <>
          <Link href="/data-pulls">{t.runDataPull}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link href="/admin">{t.reviewQueue}{data?.pendingReviews == null ? "" : ` (${number.format(data.pendingReviews)})`}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </>}
        </nav>
      </details>

      {data && (data.robots === 0 || data.sources === 0) && (
        <details className={styles.setup}>
          <summary>{t.emptyStateTitle}</summary>
          <p>{t.emptyStateDesc}</p>
          <ul>{setupCommands.map((command) => <li key={command}><code>{command}</code></li>)}</ul>
          <CopyCommands commands={setupCommands} />
        </details>
      )}
    </>
  );
}
