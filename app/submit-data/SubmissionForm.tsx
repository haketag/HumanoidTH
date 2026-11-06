"use client";

import { useState } from "react";
import { createSubmission } from "@/app/actions";

type Language = "en" | "th";
type Destination = "" | "perspective" | "robot_model";

export default function SubmissionForm({
  lang,
  currentUser,
  labels
}: {
  lang: Language;
  currentUser: { name: string | null; email: string } | null;
  labels: {
    type: string;
    destinationHint: string;
    title: string;
    refUrl: string;
    desc: string;
    submitBtn: string;
    signedInAs: string;
    locked: string;
  };
}) {
  const [destination, setDestination] = useState<Destination>("");
  const th = lang === "th";

  return (
    <form className="form panel" action={createSubmission} aria-disabled={!currentUser}>
      {currentUser && (
        <div className="notice">
          {labels.signedInAs}: <strong>{currentUser.name || currentUser.email}</strong>
        </div>
      )}

      <label>
        {labels.type}
        <select
          name="submissionType"
          required
          disabled={!currentUser}
          value={destination}
          onChange={(event) => setDestination(event.target.value as Destination)}
        >
          <option value="" disabled>{th ? "เลือกปลายทาง" : "Select destination"}</option>
          <option value="perspective">{th ? "Perspectives / มุมมองสาธารณะ" : "Perspectives"}</option>
          <option value="robot_model">{th ? "Robot Model / รุ่นหุ่นยนต์" : "Robot Model"}</option>
        </select>
        <span className="muted" style={{ fontSize: 12 }}>{labels.destinationHint}</span>
      </label>

      {destination === "perspective" ? (
        <>
          <label>
            {th ? "ชื่อบทความหรือแหล่งข่าว" : "Source title"}
            <input name="title" required disabled={!currentUser} placeholder={th ? "ชื่อข่าวหรือบทความ" : "News or article title"} />
          </label>
          <label>
            {th ? "URL แหล่งอ้างอิง" : "Source URL"}
            <input name="url" type="url" required disabled={!currentUser} placeholder="https://example.com/article" />
          </label>
          <label>
            {th ? "ประเด็นมุมมอง" : "Perspective theme"}
            <select name="perspectiveTheme" required disabled={!currentUser} defaultValue="">
              <option value="" disabled>{th ? "เลือกประเด็น" : "Select theme"}</option>
              <option value="healthcare_trust">{th ? "ความเชื่อมั่นด้านสุขภาพ" : "Healthcare trust"}</option>
              <option value="job_displacement">{th ? "ผลกระทบต่อการจ้างงาน" : "Job displacement"}</option>
              <option value="safety">{th ? "ความปลอดภัย" : "Safety"}</option>
              <option value="privacy">{th ? "ความเป็นส่วนตัว" : "Privacy"}</option>
              <option value="education">{th ? "การศึกษา" : "Education"}</option>
              <option value="ethics">{th ? "จริยธรรม" : "Ethics"}</option>
              <option value="other">{th ? "อื่น ๆ" : "Other"}</option>
            </select>
          </label>
          <label>
            {th ? "ท่าทีต่อประเด็น" : "Stance"}
            <select name="stance" required disabled={!currentUser} defaultValue="">
              <option value="" disabled>{th ? "เลือกท่าที" : "Select stance"}</option>
              <option value="supportive">{th ? "สนับสนุน" : "Supportive"}</option>
              <option value="cautious_supportive">{th ? "สนับสนุนอย่างระมัดระวัง" : "Cautiously supportive"}</option>
              <option value="neutral">{th ? "เป็นกลาง" : "Neutral"}</option>
              <option value="skeptical">{th ? "สงสัยหรือกังวล" : "Skeptical"}</option>
              <option value="critical">{th ? "วิพากษ์วิจารณ์" : "Critical"}</option>
              <option value="mixed">{th ? "หลากหลาย" : "Mixed"}</option>
            </select>
          </label>
          <label>
            {th ? "ความรู้สึกโดยรวม" : "Sentiment"}
            <select name="sentiment" required disabled={!currentUser} defaultValue="">
              <option value="" disabled>{th ? "เลือกความรู้สึก" : "Select sentiment"}</option>
              <option value="positive">{th ? "เชิงบวก" : "Positive"}</option>
              <option value="neutral">{th ? "เป็นกลาง" : "Neutral"}</option>
              <option value="negative">{th ? "เชิงลบ" : "Negative"}</option>
              <option value="mixed">{th ? "ผสมกัน" : "Mixed"}</option>
            </select>
          </label>
          <label>
            {th ? "ข้อความอ้างอิงจากแหล่งข้อมูล" : "Evidence excerpt"}
            <textarea name="evidenceExcerpt" rows={4} required disabled={!currentUser} placeholder={th ? "ยกข้อความสั้น ๆ ที่สนับสนุนมุมมองนี้" : "Short excerpt supporting this perspective"} />
          </label>
        </>
      ) : destination === "robot_model" ? (
        <>
          <label>
            {th ? "ชื่อรุ่นหุ่นยนต์" : "Robot model name"}
            <input name="title" required disabled={!currentUser} placeholder="e.g. Dinsaw Mini" />
          </label>
          <label>
            {th ? "ผู้ผลิต" : "Manufacturer"}
            <input name="manufacturer" disabled={!currentUser} placeholder={th ? "ชื่อบริษัทผู้ผลิต" : "Manufacturer name"} />
          </label>
          <label>
            {th ? "องค์กรผู้พัฒนา" : "Developer organization"}
            <input name="developerOrg" disabled={!currentUser} placeholder={th ? "มหาวิทยาลัย ห้องแล็บ หรือบริษัท" : "University, lab or company"} />
          </label>
          <label>
            {th ? "ประเทศต้นกำเนิด" : "Country of origin"}
            <input name="countryOfOrigin" disabled={!currentUser} placeholder={th ? "เช่น ประเทศไทย" : "e.g. Thailand"} />
          </label>
          <label>
            {th ? "ประเภทหุ่นยนต์" : "Robot type"}
            <select name="robotType" disabled={!currentUser} defaultValue="">
              <option value="">{th ? "เลือกประเภท" : "Select type"}</option>
              <option value="humanoid">{th ? "ฮิวแมนนอยด์" : "Humanoid"}</option>
              <option value="social">{th ? "หุ่นยนต์สังคม" : "Social robot"}</option>
              <option value="service">{th ? "หุ่นยนต์บริการ" : "Service robot"}</option>
              <option value="education">{th ? "หุ่นยนต์เพื่อการศึกษา" : "Education robot"}</option>
              <option value="other">{th ? "อื่น ๆ" : "Other"}</option>
            </select>
          </label>
          <label>
            {th ? "สถานะในประเทศไทย" : "Thailand status"}
            <select name="thailandStatus" required disabled={!currentUser} defaultValue="">
              <option value="" disabled>{th ? "เลือกสถานะ" : "Select status"}</option>
              <option value="observed_in_thailand">{th ? "พบการใช้งานหรือจัดแสดงในไทย" : "Observed in Thailand"}</option>
              <option value="developed_in_thailand">{th ? "พัฒนาในไทย" : "Developed in Thailand"}</option>
              <option value="imported_for_evaluation">{th ? "นำเข้ามาทดลอง" : "Imported for evaluation"}</option>
              <option value="unknown">{th ? "ยังไม่ทราบ" : "Unknown"}</option>
            </select>
          </label>
          <label>
            {th ? "การใช้งานหลัก" : "Primary use case"}
            <input name="primaryUseCase" disabled={!currentUser} placeholder={th ? "เช่น ดูแลผู้สูงอายุ" : "e.g. Eldercare"} />
          </label>
          <label>
            {th ? "ลิงก์แหล่งอ้างอิง" : "Evidence URL"}
            <input name="url" type="url" required disabled={!currentUser} placeholder="https://example.com/robot" />
          </label>
          <label>
            {th ? "เว็บไซต์ทางการ (ถ้ามี)" : "Official website (optional)"}
            <input name="officialUrl" type="url" disabled={!currentUser} placeholder="https://example.com" />
          </label>
          <label>
            {th ? "คำอธิบายรุ่นหุ่นยนต์" : "Robot model description"}
            <textarea name="description" rows={4} disabled={!currentUser} placeholder={th ? "คุณสมบัติ การใช้งาน และหลักฐานที่เกี่ยวข้อง" : "Features, use cases and supporting evidence"} />
          </label>
        </>
      ) : null}

      <button className="primary" type="submit" disabled={!currentUser || !destination} style={{ marginTop: 10 }}>
        {labels.submitBtn}
      </button>
      {!currentUser && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{labels.locked}</p>}
    </form>
  );
}
