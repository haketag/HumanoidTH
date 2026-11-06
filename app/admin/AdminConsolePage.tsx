import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getTranslation } from "@/lib/translations";
import { currentActor } from '@/lib/company-auth';
import {
  approvePerspectiveSubmission,
  approveRobotModelSubmission,
  updateSubmissionStatus,
  upsertContributionAction,
  upsertRobotModelAction,
  upsertSourceRecordAction,
  upsertSubmittedDataAction
} from "@/app/actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  collection?: string;
  selectedId?: string;
  q?: string;
  status?: string;
}>;

type CmsCollection = "source-records" | "robot-models" | "contributions" | "submitted-data";

const collectionLabels: Record<CmsCollection, string> = {
  "source-records": "Source Records",
  "robot-models": "Robot Models",
  contributions: "Contributions",
  "submitted-data": "Submitted Data"
};

const sourceTypes = ["SEED", "RSS", "GDELT", "YOUTUBE", "OPENALEX", "GITHUB", "MANUAL_SOCIAL", "SUBMISSION", "WEB"] as const;
const relevanceStatuses = ["PENDING", "ACCEPTED", "REJECTED", "UNCERTAIN"] as const;
const reviewStatuses = ["QUEUED", "FETCHING", "ANALYZED", "NEEDS_REVIEW", "APPROVED", "REJECTED", "FAILED"] as const;
const visibilityOptions = ["public", "private"] as const;
const robotStatusOptions = ["observed_in_thailand", "developed_in_thailand", "imported_for_evaluation", "unknown"] as const;

const submissionFieldLabels: Record<string, { en: string; th: string }> = {
  perspectiveTheme: { en: "Theme", th: "ประเด็นมุมมอง" },
  stance: { en: "Stance", th: "ท่าที" },
  sentiment: { en: "Sentiment", th: "ความรู้สึก" },
  evidenceExcerpt: { en: "Evidence excerpt", th: "ข้อความอ้างอิง" },
  canonicalName: { en: "Robot model", th: "ชื่อรุ่นหุ่นยนต์" },
  manufacturer: { en: "Manufacturer", th: "ผู้ผลิต" },
  developerOrg: { en: "Developer organization", th: "องค์กรผู้พัฒนา" },
  countryOfOrigin: { en: "Country of origin", th: "ประเทศต้นกำเนิด" },
  robotType: { en: "Robot type", th: "ประเภทหุ่นยนต์" },
  thailandStatus: { en: "Thailand status", th: "สถานะในประเทศไทย" },
  primaryUseCase: { en: "Primary use case", th: "การใช้งานหลัก" },
  officialUrl: { en: "Official website", th: "เว็บไซต์ทางการ" },
  description: { en: "Description", th: "คำอธิบาย" }
};

function toLocalDateTime(value?: Date | null) {
  if (!value) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default async function AdminConsolePage({ searchParams }: { searchParams: SearchParams }) {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value || "en") as "en" | "th";
  const t = getTranslation(lang);
  const isAdmin = (await currentActor())?.isAdmin === true;

  const localT = {
    en: {
      denied: "Access Denied",
      deniedDesc: "You must have the ADMIN role to review submissions or edit CMS content.",
      goProfile: "Go to Profile & Login as Admin",
      addNew: "Add new record",
      save: "Save record",
      create: "Create record",
      list: "Admin records",
      editor: "Record editor",
      empty: "No records found for this collection.",
      dbOffline: "Database connection failed. CMS content cannot be mocked because this page edits live records.",
      sourceRecord: "Source Record",
      robotModel: "Robot Model",
      contribution: "Contribution",
      submittedData: "Submitted Data"
    },
    th: {
      denied: "ปฏิเสธการเข้าถึง",
      deniedDesc: "คุณต้องมีบทบาทผู้ดูแลระบบ (ADMIN) เพื่อแก้ไขข้อมูล CMS",
      goProfile: "ไปที่โปรไฟล์และเข้าสู่ระบบในฐานะผู้ดูแล",
      addNew: "เพิ่มรายการใหม่",
      save: "บันทึกรายการ",
      create: "สร้างรายการ",
      list: "รายการในคอลเลกชัน",
      editor: "ตัวแก้ไขข้อมูล",
      empty: "ไม่พบรายการในคอลเลกชันนี้",
      dbOffline: "การเชื่อมต่อฐานข้อมูลล้มเหลว หน้านี้แก้ไขข้อมูลจริงจึงไม่สามารถใช้ข้อมูลตัวอย่างได้",
      sourceRecord: "บันทึกแหล่งข้อมูล",
      robotModel: "โมเดลหุ่นยนต์",
      contribution: "รายการผลงาน",
      submittedData: "ข้อมูลที่ส่งมา"
    }
  }[lang];

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div style={{ maxWidth: "560px", margin: "40px auto", textAlign: "center" }} className="panel">
          <h1 style={{ color: "var(--danger)" }}>{localT.denied}</h1>
          <p className="muted" style={{ margin: "14px 0" }}>{localT.deniedDesc}</p>
          <Link href="/profile" className="button primary">{localT.goProfile}</Link>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const collection = (["source-records", "robot-models", "contributions", "submitted-data"] as const).includes(
    params.collection as CmsCollection
  )
    ? (params.collection as CmsCollection)
    : "submitted-data";
  const selectedId = params.selectedId;
  const isNew = selectedId === "new";
  const query = (params.q || "").trim().slice(0, 150);
  const statusFilter = params.status === "APPROVED" ? "APPROVED" : params.status === "pending" ? "pending" : "all";

  let dbOffline = false;
  let errorMessage: string | null = null;
  let records: any[] = [];
  let robotOptions: Array<{ id: string; canonicalName: string }> = [];

  try {
    if (collection === "source-records") {
      records = await prisma.sourceRecord.findMany({
        orderBy: { updatedAt: "desc" },
        take: 100
      });
    } else if (collection === "robot-models") {
      records = await prisma.robotModel.findMany({
        orderBy: { updatedAt: "desc" },
        take: 100
      });
    } else if (collection === "contributions") {
      records = await prisma.contribution.findMany({
        include: { relatedRobotModel: true },
        orderBy: { updatedAt: "desc" },
        take: 100
      });
      robotOptions = await prisma.robotModel.findMany({
        select: { id: true, canonicalName: true },
        orderBy: { canonicalName: "asc" }
      });
    } else {
      const search = query ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { url: { contains: query, mode: "insensitive" as const } },
          { submitterContact: { contains: query, mode: "insensitive" as const } }
        ]
      } : {};
      if (query || statusFilter !== "all") {
        records = await prisma.submittedData.findMany({
          where: {
            ...search,
            ...(statusFilter === "APPROVED" ? { status: "APPROVED" as const } :
              statusFilter === "pending" ? { status: { in: ["QUEUED", "NEEDS_REVIEW"] as const } } : {})
          },
          orderBy: { updatedAt: "desc" },
          take: 100
        });
      } else {
        const [pending, reviewed] = await Promise.all([
          prisma.submittedData.findMany({
            where: { status: { in: ["QUEUED", "NEEDS_REVIEW"] } },
            orderBy: { createdAt: "desc" },
            take: 100
          }),
          prisma.submittedData.findMany({
            where: { status: { notIn: ["QUEUED", "NEEDS_REVIEW"] } },
            orderBy: { updatedAt: "desc" },
            take: 50
          })
        ]);
        records = [...pending, ...reviewed];
      }
    }
  } catch (error) {
    dbOffline = true;
    errorMessage = error instanceof Error ? error.message : "Unknown database error";
  }

  const selectedItem = isNew ? null : records.find((record) => record.id === selectedId) ?? records[0] ?? null;
  const selectedPayload = selectedItem?.payloadJson && typeof selectedItem.payloadJson === "object" && !Array.isArray(selectedItem.payloadJson)
    ? selectedItem.payloadJson as Record<string, unknown>
    : {};
  const isNewSubmissionType = selectedItem?.submissionType === "perspective" || selectedItem?.submissionType === "robot_model";

  const collectionTabs = [
    { key: "submitted-data" as const, label: "Review Queue" },
    { key: "source-records" as const, label: localT.sourceRecord },
    { key: "robot-models" as const, label: localT.robotModel },
    { key: "contributions" as const, label: localT.contribution }
  ];

  const titleForCollection = collectionLabels[collection];
  const queueParams = new URLSearchParams();
  if (query) queueParams.set("q", query);
  if (statusFilter !== "all") queueParams.set("status", statusFilter);
  const queueSuffix = queueParams.toString() ? `&${queueParams}` : "";

  return (
    <div className="admin-page">
      <div className="topline">
        <div>
          <h1>{t.adminTitle}</h1>
          <p className="muted">{t.adminDesc} {t.cmsDesc}</p>
        </div>
        <Link className="button primary" href="/admin?collection=submitted-data">
          Review queue
        </Link>
      </div>

      {dbOffline && (
        <div className="notice" style={{ backgroundColor: "#fff4f4", borderLeftColor: "var(--danger)", marginBottom: "16px" }}>
          <strong>Database Offline:</strong> {localT.dbOffline}
          <div className="muted" style={{ marginTop: "6px", fontSize: "12px" }}>{errorMessage}</div>
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 0 }}>
        {collectionTabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin?collection=${tab.key}${selectedItem ? `&selectedId=${selectedItem.id}` : "&selectedId=new"}`}
            className={`button ${collection === tab.key ? "primary" : ""}`}
          >
            {tab.label}
          </Link>
        ))}
        <Link href={`/admin?collection=${collection}&selectedId=new`} className="button">
          {localT.addNew}
        </Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(360px, 0.8fr)" }}>
        <section className="panel">
          {collection === "submitted-data" && (
            <form action="/admin" method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <input type="hidden" name="collection" value="submitted-data" />
              <input name="q" type="search" defaultValue={query} placeholder={lang === "th" ? "ค้นหาชื่อ ลิงก์ หรืออีเมลผู้ส่ง" : "Search title, URL or submitter email"} aria-label={lang === "th" ? "ค้นหาคำขอ" : "Search submissions"} style={{ flex: "1 1 220px" }} />
              <select name="status" defaultValue={statusFilter} aria-label={lang === "th" ? "กรองสถานะ" : "Filter status"}>
                <option value="all">{lang === "th" ? "ทุกสถานะ" : "All statuses"}</option>
                <option value="pending">{lang === "th" ? "รอตรวจ" : "Pending review"}</option>
                <option value="APPROVED">{lang === "th" ? "อนุมัติแล้ว" : "Approved"}</option>
              </select>
              <button type="submit" className="button">{lang === "th" ? "ค้นหา" : "Search"}</button>
            </form>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline" }}>
            <div>
              <h2>{localT.list}</h2>
              <div className="muted" style={{ fontSize: "12px" }}>{titleForCollection}</div>
            </div>
            <div className="badge">{records.length} items</div>
          </div>

          <div className="table-wrap" style={{ marginTop: "12px" }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Meta</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    style={{
                      background: selectedItem?.id === record.id ? "var(--surface-muted)" : "transparent",
                      cursor: "pointer"
                    }}
                  >
                    <td>
                      <Link href={`/admin?collection=${collection}&selectedId=${record.id}${collection === "submitted-data" ? queueSuffix : ""}`} style={{ color: "inherit", display: "block" }}>
                        <strong>
                          {record.title || record.canonicalName || record.displayName || "Untitled"}
                        </strong>
                        <div className="muted" style={{ fontSize: "12px", maxWidth: "380px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {record.url || record.sourceUrl || record.description || record.notes || record.organization || ""}
                        </div>
                      </Link>
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {collection === "source-records" && (
                        <>
                          <span className="badge">{record.sourceType}</span>{" "}
                          <span className="badge">{record.relevanceStatus}</span>
                        </>
                      )}
                      {collection === "robot-models" && (
                        <>
                          <span className="badge">{record.robotType}</span>{" "}
                          <span className="badge">{record.thailandStatus}</span>
                        </>
                      )}
                      {collection === "contributions" && (
                        <>
                          <span className="badge">{record.contributionType}</span>{" "}
                          <span className="badge">{record.verificationStatus}</span>
                        </>
                      )}
                      {collection === "submitted-data" && <span className="badge">{record.status}</span>}
                    </td>
                    <td style={{ fontSize: "12px" }}>{record.updatedAt?.toLocaleDateString?.() ?? ""}</td>
                  </tr>
                ))}
                {!records.length && (
                  <tr>
                    <td className="empty" colSpan={3}>{localT.empty}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline" }}>
            <div>
              <h2>{localT.editor}</h2>
              <div className="muted" style={{ fontSize: "12px" }}>
                {isNew ? localT.create : selectedItem?.title || selectedItem?.canonicalName || selectedItem?.displayName || "Selected record"}
              </div>
            </div>
            {!isNew && selectedItem && (
              <Link href={`/admin?collection=${collection}&selectedId=new`} className="button">
                {localT.addNew}
              </Link>
            )}
          </div>

          {!selectedItem && !isNew && (
            <div className="empty" style={{ paddingTop: "28px" }}>
              {localT.empty}
            </div>
          )}

          {collection === "source-records" && (
            <form action={upsertSourceRecordAction} className="form" style={{ marginTop: "12px" }}>
              <input type="hidden" name="id" defaultValue={selectedItem?.id ?? ""} />
              <label>
                Title
                <input name="title" defaultValue={selectedItem?.title ?? ""} />
              </label>
              <label>
                URL
                <input name="url" defaultValue={selectedItem?.url ?? ""} placeholder="https://example.com/article" />
              </label>
              <label>
                Source Type
                <select name="sourceType" defaultValue={selectedItem?.sourceType ?? "WEB"}>
                  {sourceTypes.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                Excerpt
                <textarea name="excerpt" rows={4} defaultValue={selectedItem?.excerpt ?? ""} />
              </label>
              <label>
                Published At
                <input type="datetime-local" name="publishedAt" defaultValue={toLocalDateTime(selectedItem?.publishedAt)} />
              </label>
              <label>
                Author
                <input name="author" defaultValue={selectedItem?.author ?? ""} />
              </label>
              <label>
                Platform
                <input name="platform" defaultValue={selectedItem?.platform ?? ""} />
              </label>
              <label>
                Relevance Status
                <select name="relevanceStatus" defaultValue={selectedItem?.relevanceStatus ?? "PENDING"}>
                  {relevanceStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                Relevance Confidence
                <input type="number" step="0.01" min="0" max="1" name="relevanceConfidence" defaultValue={selectedItem?.relevanceConfidence ?? 0} />
              </label>
              <label>
                Relevance Reason
                <textarea name="relevanceReason" rows={3} defaultValue={selectedItem?.relevanceReason ?? ""} />
              </label>
              <button type="submit" className="primary">
                {selectedItem ? localT.save : localT.create}
              </button>
            </form>
          )}

          {collection === "robot-models" && (
            <form action={upsertRobotModelAction} className="form" style={{ marginTop: "12px" }}>
              <input type="hidden" name="id" defaultValue={selectedItem?.id ?? ""} />
              <label>
                Canonical Name
                <input name="canonicalName" defaultValue={selectedItem?.canonicalName ?? ""} />
              </label>
              <label>
                Manufacturer
                <input name="manufacturer" defaultValue={selectedItem?.manufacturer ?? ""} />
              </label>
              <label>
                Developer Org
                <input name="developerOrg" defaultValue={selectedItem?.developerOrg ?? ""} />
              </label>
              <label>
                Country of Origin
                <input name="countryOfOrigin" defaultValue={selectedItem?.countryOfOrigin ?? ""} />
              </label>
              <label>
                Robot Type
                <input name="robotType" defaultValue={selectedItem?.robotType ?? "unknown"} />
              </label>
              <label>
                Thailand Status
                <select name="thailandStatus" defaultValue={selectedItem?.thailandStatus ?? "observed_in_thailand"}>
                  {robotStatusOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                Embodiment Level
                <input name="embodimentLevel" defaultValue={selectedItem?.embodimentLevel ?? ""} />
              </label>
              <label>
                Primary Use Case
                <input name="primaryUseCase" defaultValue={selectedItem?.primaryUseCase ?? ""} />
              </label>
              <label>
                Official URL
                <input name="officialUrl" defaultValue={selectedItem?.officialUrl ?? ""} />
              </label>
              <label>
                Description
                <textarea name="description" rows={4} defaultValue={selectedItem?.description ?? ""} />
              </label>
              <label>
                Status Confidence
                <input type="number" step="0.01" min="0" max="1" name="statusConfidence" defaultValue={selectedItem?.statusConfidence ?? 0.5} />
              </label>
              <label>
                First Seen Year
                <input type="number" name="firstSeenYear" defaultValue={selectedItem?.firstSeenYear ?? ""} />
              </label>
              <label>
                Last Verified At
                <input type="datetime-local" name="lastVerifiedAt" defaultValue={toLocalDateTime(selectedItem?.lastVerifiedAt)} />
              </label>
              <button type="submit" className="primary">
                {selectedItem ? localT.save : localT.create}
              </button>
            </form>
          )}

          {collection === "contributions" && (
            <form action={upsertContributionAction} className="form" style={{ marginTop: "12px" }}>
              <input type="hidden" name="id" defaultValue={selectedItem?.id ?? ""} />
              <label>
                Title
                <input name="title" defaultValue={selectedItem?.title ?? ""} />
              </label>
              <label>
                Contribution Type
                <input name="contributionType" defaultValue={selectedItem?.contributionType ?? ""} />
              </label>
              <label>
                Contributor Name
                <input name="contributorName" defaultValue={selectedItem?.contributorName ?? ""} />
              </label>
              <label>
                Contributor Type
                <input name="contributorType" defaultValue={selectedItem?.contributorType ?? ""} />
              </label>
              <label>
                Organization
                <input name="organization" defaultValue={selectedItem?.organization ?? ""} />
              </label>
              <label>
                Related Robot Model
                <select name="relatedRobotModelId" defaultValue={selectedItem?.relatedRobotModelId ?? ""}>
                  <option value="">None</option>
                  {robotOptions.map((robot) => (
                    <option key={robot.id} value={robot.id}>{robot.canonicalName}</option>
                  ))}
                </select>
              </label>
              <label>
                Source URL
                <input name="sourceUrl" defaultValue={selectedItem?.sourceUrl ?? ""} />
              </label>
              <label>
                License
                <input name="license" defaultValue={selectedItem?.license ?? ""} />
              </label>
              <label>
                Visibility
                <select name="visibility" defaultValue={selectedItem?.visibility ?? "public"}>
                  {visibilityOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                Verification Status
                <select name="verificationStatus" defaultValue={selectedItem?.verificationStatus ?? "NEEDS_REVIEW"}>
                  {reviewStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                Description
                <textarea name="description" rows={4} defaultValue={selectedItem?.description ?? ""} />
              </label>
              <button type="submit" className="primary">
                {selectedItem ? localT.save : localT.create}
              </button>
            </form>
          )}

          {collection === "submitted-data" && (
            <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
              {selectedItem && (
                <section className="notice" style={{ margin: 0 }} aria-label={lang === "th" ? "ตัวอย่างข้อมูลที่ส่ง" : "Submission preview"}>
                  <strong>{lang === "th" ? "ข้อมูลที่ส่งมาเพื่อตรวจสอบ" : "Submission preview"}</strong>
                  <p style={{ margin: "8px 0" }}>
                    <span className="badge">{selectedItem.submissionType === "perspective" ? "Perspectives" : selectedItem.submissionType === "robot_model" ? "Robot Model" : selectedItem.submissionType}</span>{" "}
                    <span className="badge">{selectedItem.status}</span>
                  </p>
                  <p><strong>{selectedItem.title}</strong></p>
                  {selectedItem.url && <p><a href={selectedItem.url} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>{selectedItem.url}</a></p>}
                  <dl style={{ display: "grid", gridTemplateColumns: "minmax(130px, 1fr) 2fr", gap: "8px 12px", margin: "12px 0 0" }}>
                    {Object.entries(submissionFieldLabels).map(([key, label]) => {
                      const value = selectedPayload[key];
                      if (typeof value !== "string" || !value) return null;
                      return (
                        <div key={key} style={{ display: "contents" }}>
                          <dt className="muted">{label[lang]}</dt>
                          <dd style={{ margin: 0, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                  {selectedItem.submitterContact && <p className="muted" style={{ marginTop: 12 }}>{lang === "th" ? "ผู้ส่ง" : "Submitted by"}: {selectedItem.submitterName || selectedItem.submitterContact} ({selectedItem.submitterContact})</p>}
                  {selectedItem.submissionType === "perspective" && selectedItem.status === "APPROVED" && typeof selectedPayload.publishedAnnotationId === "string" && (
                    <p style={{ marginTop: 12 }}><Link href="/perspectives">{lang === "th" ? "ดูข้อมูลที่เผยแพร่ใน Perspectives" : "View published Perspectives"}</Link></p>
                  )}
                  {selectedItem.submissionType === "robot_model" && selectedItem.status === "APPROVED" && typeof selectedPayload.publishedRobotModelId === "string" && (
                    <p style={{ marginTop: 12 }}><Link href="/robots">{lang === "th" ? "ดูข้อมูลที่เผยแพร่ใน Robots" : "View published Robots"}</Link></p>
                  )}
                </section>
              )}
              {selectedItem && (
                <div className="notice" style={{ margin: 0 }}>
                  <strong>Review actions</strong>
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                    <form action={selectedItem.submissionType === "perspective" ? approvePerspectiveSubmission.bind(null, selectedItem.id) : selectedItem.submissionType === "robot_model" ? approveRobotModelSubmission.bind(null, selectedItem.id) : updateSubmissionStatus.bind(null, selectedItem.id, "APPROVED")}>
                      <button type="submit" className="primary" disabled={selectedItem.status === "APPROVED"} style={{ background: "var(--success)", borderColor: "var(--success)" }}>
                        Approve
                      </button>
                    </form>
                    <form action={updateSubmissionStatus.bind(null, selectedItem.id, "REJECTED")}>
                      <button type="submit" className="button" disabled={isNewSubmissionType && selectedItem.status === "APPROVED"} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
                        Reject
                      </button>
                    </form>
                    <form action={updateSubmissionStatus.bind(null, selectedItem.id, "NEEDS_REVIEW")}>
                      <button type="submit" className="button" disabled={isNewSubmissionType && selectedItem.status === "APPROVED"}>
                        Needs review
                      </button>
                    </form>
                  </div>
                </div>
              )}

              <form action={upsertSubmittedDataAction} className="form">
                <input type="hidden" name="id" defaultValue={selectedItem?.id ?? ""} />
                <label>
                  Submission Type
                  <input name="submissionType" defaultValue={selectedItem?.submissionType ?? ""} />
                </label>
                <label>
                  Title
                  <input name="title" defaultValue={selectedItem?.title ?? ""} />
                </label>
                <label>
                  URL
                  <input name="url" defaultValue={selectedItem?.url ?? ""} />
                </label>
                <label>
                  Status
                  <select name="status" defaultValue={selectedItem?.status ?? "QUEUED"}>
                    {reviewStatuses.map((value) => <option key={value} value={value} disabled={isNewSubmissionType && value === "APPROVED"}>{value}</option>)}
                  </select>
                </label>
                <label>
                  Submitter Name
                  <input name="submitterName" defaultValue={selectedItem?.submitterName ?? ""} />
                </label>
                <label>
                  Submitter Contact
                  <input name="submitterContact" defaultValue={selectedItem?.submitterContact ?? ""} />
                </label>
                <label>
                  Notes
                  <textarea name="notes" rows={4} defaultValue={selectedItem?.notes ?? ""} />
                </label>
                <label>
                  Review Notes
                  <textarea name="reviewNotes" rows={4} defaultValue={selectedItem?.reviewNotes ?? ""} />
                </label>
                <button type="submit" className="primary">
                  {selectedItem ? localT.save : localT.create}
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
