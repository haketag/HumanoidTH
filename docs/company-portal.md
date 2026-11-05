# Company Portal V1 — รายงานและวิธีใช้งาน

วันที่: 2 พฤศจิกายน 2569 (Asia/Bangkok)

## 1. Repository Audit

- ระบบจริงคือ Next.js 15 App Router / React 19 / Prisma 6 / PostgreSQL มี `User`, `Entity`, `RobotModel`, `Contribution`, `SourceRecord`, `SubmittedData` อยู่แล้ว
- นำ User และข้อมูลสาธารณะเดิมกลับมาใช้ ไม่สร้างทะเบียนหุ่นยนต์หรืองานวิจัยอีกชุด `Entity` ใช้เป็นองค์กรสาธารณะหลังอนุมัติ
- เดิมไม่มีการยืนยันตัวตนด้วยรหัสผ่านสำหรับสมาชิก มี role selector / quick simulator และคุกกี้ `admin_session=true` / `user_email` / `user_role` ซึ่งไม่ใช่หลักฐานสิทธิ์ที่เชื่อถือได้
- คำสั่ง server action สำหรับแก้ CMS เดิมไม่มี server-side admin guard และหน้า profile แสดงรายชื่อ/อีเมลผู้ใช้ทั้งหมด จึงต้องปิดช่องเหล่านี้เพื่อไม่ให้ข้ามขั้นตอนพอร์ทัลใหม่
- ฐานจริงสร้างด้วย `db:push` ไม่มี `_prisma_migrations` จึงไม่รัน migrate reset, ไม่ baseline และไม่ใช้ migrate deploy ที่อาจพยายามสร้างตารางเดิมซ้ำ
- ไม่มีระบบเก็บไฟล์ที่เหมาะนำกลับมาใช้ จึงรับลิงก์ภาพและเอกสารแทนอัปโหลดใน V1

## 2. Implemented Features

- `/company`: สมัครบัญชี / เข้าสู่ระบบด้วยรหัสผ่าน ขอสิทธิ์แทนบริษัทเดิมหรือใหม่ ส่งหลักฐานส่วนตัว ติดตามผล ขอข้อมูลเพิ่มเติมและส่งซ้ำ
- สมาชิกบริษัทต้องได้รับอนุมัติอย่างชัดเจน อีเมลตรงโดเมนไม่ได้ให้สิทธิ์เอง รองรับสมาชิกหลายคนต่อบริษัท
- ร่างโปรไฟล์ชื่อ โลโก้ คำอธิบาย เว็บไซต์ และข้อมูลติดต่อที่ตั้งใจเปิดเผยสาธารณะ
- ร่างหุ่นยนต์ใหม่ หรือระบุ ID เพื่อเสนอแก้หุ่นยนต์เดิม พร้อมหน้าผลิตภัณฑ์ แหล่งอ้างอิง รหัสรุ่น ข้อมูลทางเทคนิค และข้อกล่าวอ้างพร้อมลิงก์ต่อข้อ
- ส่งบทความวิจัย / เอกสารเทคนิค / คู่มือ พร้อมผู้เขียน ลิงก์ต้นฉบับ DOI ถ้ามี และหลักฐานความสัมพันธ์เมื่อเลือกเชื่อมกับหุ่นยนต์
- สถานะ `DRAFT → PENDING_REVIEW → APPROVED / CHANGES_REQUESTED / REJECTED` แก้ไข/ส่งใหม่ได้เมื่อขอข้อมูลเพิ่ม รายการอนุมัติแล้วต้องสร้างข้อเสนอใหม่
- `/company-review`: คิวตรวจสิทธิ์และข้อเสนอ ดูข้อมูลสาธารณะปัจจุบันเทียบฉบับเสนอ อนุมัติ/ปฏิเสธ/ขอข้อมูลเพิ่ม พร้อมเหตุผล ประวัติผู้ตรวจ เวลา และ snapshot
- `/companies` และ `/companies/[id]`: เผยแพร่เฉพาะโปรไฟล์ที่อนุมัติ แสดงหุ่นยนต์/เอกสารที่อนุมัติแล้ว
- หุ่นยนต์และผลงานอนุมัติถูกเขียนลง RobotModel / Contribution เดิม จึงแสดงใน catalog, detail และ contributions เดิมได้
- แยก submitted-by organization, claimed manufacturer และ admin-reviewed organization relationship ใน metadata และ CompanyRobot ไม่เปลี่ยนคำกล่าวอ้างบริษัทเป็นความสามารถที่ยืนยันโดยอิสระ
- ตรวจชื่อ/เว็บไซต์ซ้ำ ชื่อหุ่นยนต์แบบ trim/lowercase ลิงก์/DOI ซ้ำ และเวอร์ชันเก่า ใช้ row lock, advisory lock และ transaction สำหรับอนุมัติ
- ไม่เปลี่ยน matching logic ของ Humanoid Match หรือรูปแบบ localStorage ของรายการที่ถูกใจ

## 3. Modified Files

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/company-validation.ts` | schema validation, safe URLs, DOI, strict payload / ป้องกัน mass assignment |
| `lib/company-auth.ts` | scrypt password hash, opaque token session, database expiry/revocation, server-side admin guard, persisted rate limits |
| `lib/company-service.ts` | permissions, private drafts, transitions, comparison baselines, publication transactions, provenance, audit history |
| `app/api/company/route.ts` | API บัญชี/คำขอ/ร่าง/ส่งตรวจ/ผลตรวจ และ approved-only public reads, same-origin check, no-store, body limit 64 KB |
| `app/company/page.tsx`, `portal.tsx`, `portal.module.css` | Company Portal และฟอร์ม light theme ไทย/desktop/mobile |
| `app/company-review/page.tsx` | server-gated admin review page |
| `app/companies/page.tsx`, `app/companies/[id]/page.tsx` | directory และโปรไฟล์สาธารณะเฉพาะรายการอนุมัติ |
| `prisma/schema.prisma`, migration `20261102000100_company_portal/migration.sql` | ตารางและความสัมพันธ์เพิ่มใหม่ |
| `scripts/company-migrate.ts` | dry run / apply แบบ additive, snapshot และ count assertions |
| `scripts/company-http-test.mjs` | production-build HTTP tests บน disposable database; fixtures ไม่แตะฐานจริง |
| `test/company-validation.test.ts`, `company-integration.test.ts` | validation/security/lifecycle/concurrency/rollback tests |
| `test/seed-protection.test.ts` | กัน seed sync ทับข้อมูลตรวจแล้ว |
| `app/actions.ts`, `app/admin/AdminConsolePage.tsx`, `app/admin/page.tsx` | ป้องกัน server actions เดิมด้วย session จริง และลิงก์คิวบริษัท |
| `middleware.ts` | เลิกใช้ Basic Auth credentials สำรองที่ฝังในโค้ด |
| `app/profile/page.tsx`, `app/submit-data/page.tsx` | เลิกสวมบัญชีด้วยอีเมลและ role; เก็บประวัติการส่งข้อมูลเดิมโดยผูก session จริง |
| `app/database/page.tsx`, `app/contributions/page.tsx` | ไม่เผยแพร่ private contributions และข้อมูลการส่งของคนอื่น |
| `app/components/SidebarNav.tsx` | เมนู Company Portal / Companies |
| `lib/seed-importer.ts` | ล็อกระเบียนก่อน seed update และข้ามข้อมูลที่ผ่าน source review / company approval |

ไฟล์งานแดชบอร์ด/รูปภาพ/รายการที่ถูกใจที่ค้างอยู่ก่อนหน้านี้ไม่ถูกย้อนกลับ ไม่ได้ commit หรือ push แทนผู้ใช้

## 4. Database Changes

เพิ่ม 8 ตาราง: CompanyAccount, CompanySession, Company, CompanyMembership, CompanySubmission, CompanyReview, CompanyRobot, CompanyRateLimit

- เพิ่ม foreign keys ไปยัง User, Entity และ RobotModel เดิม พร้อม unique constraints และสถานะที่มี CHECK constraints
- เพิ่ม unique expression index สำหรับชื่อ RobotModel แบบ lowercase/trim; ไม่มีการเปลี่ยน ID/URL ของรายการเดิม
- schema ผ่าน `prisma validate`; SQL migration ถูกนำไปใช้ใน temporary schema และ disposable database ก่อนใช้กับฐานจริง
- ใช้ SQL parameter binding ผ่าน Prisma raw queries เพื่อไม่ต้องพึ่ง generated client รุ่นใหม่ในขั้น migration และให้ทดสอบใน schema แยกได้
- migration จริงบันทึก snapshot/receipt ที่ `output/company-portal/` จำนวนก่อนและหลังเท่ากัน: RobotModel 17, SourceRecord 6,722, Contribution 5, User 1 ไม่มีบริษัทหรือหุ่นยนต์สมมติเข้าฐานจริง
- **ฐานจริงไม่มี Prisma migration history**: ฐานเดิมนี้ใช้ `node --import tsx scripts/company-migrate.ts --apply` ไปแล้ว ห้ามรันซ้ำ; script ปฏิเสธเมื่อพบ Company อยู่แล้ว ฐานใหม่ว่างสามารถใช้ migration history ตามปกติ

## 5. Permission Model

| ผู้ใช้ | สิทธิ์ |
|---|---|
| ผู้ชม | อ่านโปรไฟล์/หุ่นยนต์/ผลงานที่เผยแพร่ ไม่เห็น drafts, verification evidence, private contacts หรือคิวตรวจ |
| บัญชีสมัครใหม่ | ขอสิทธิ์เป็นตัวแทนบริษัท ดูคำขอของตน ยังจัดการบริษัทไม่ได้ |
| สมาชิกที่อนุมัติ | สร้าง/แก้ร่างของตน ส่งข้อเสนอของบริษัทที่ได้รับสิทธิ์ ดูผลตรวจ ไม่มีสิทธิ์ publish หรือสวมบริษัทอื่น |
| แอดมินที่ยืนยันแล้ว | อ่านคิวและหลักฐาน ตรวจสิทธิ์ตัวแทน/ความสัมพันธ์หุ่นยนต์ ขอแก้/ปฏิเสธ/อนุมัติใน transaction |

- สิทธิ์ admin ของพอร์ทัลมาจาก CompanyAccount ที่สร้างผ่านการเข้าสู่ระบบด้วย `ADMIN_BASIC_USER` + `ADMIN_BASIC_PASSWORD` ที่ตั้งใน environment เท่านั้น ไม่อ่าน role จาก request หรือคุกกี้เดิม และไม่มี default password ในโค้ด
- ตรวจ session ด้วย token สุ่ม 256-bit เก็บเฉพาะ SHA-256 ของ token ในฐานข้อมูล, HttpOnly / SameSite=Lax / Secure ใน production, อายุ 8 ชั่วโมง และ revoke เมื่อ logout
- password ใช้ scrypt พร้อม salt สุ่ม ตรวจด้วย timing-safe comparison; ห้ามนำ password hash หรือ session token ส่งผ่าน API
- กำหนด URL สาธารณะ http/https ปฏิเสธ credentials-in-URL, IP literal, localhost, executable schemes; ไม่ fetch URL ผู้ใช้จาก server จึงไม่เพิ่ม document-fetch SSRF surface
- same-origin POST, JSON strict schema, 64 KB body limit, rate limit แบบ persisted สำหรับการเข้าสู่ระบบ การสมัคร และคำสั่งเขียน
- legacy User.role ถูกเก็บเพื่อ compatibility แต่ไม่เพียงพอจะเป็นแอดมินพอร์ทัล; quick role simulator เดิมย้ายไป secure login

## 6. Testing Results

คำสั่งที่รันจริง:

```powershell
npm run typecheck
node node_modules/prisma/build/index.js validate
$env:COMPANY_PORTAL_DB_TESTS='1'
npm test
npm run build
npm run lint
node --import tsx scripts/company-migrate.ts
node --import tsx scripts/company-migrate.ts --apply
node scripts/company-http-test.mjs
```

- Typecheck / Prisma schema validation / Prisma client generation / production build ผ่าน
- Unit + integration + regression: 14 tests ผ่าน ไม่มี skip เมื่อเปิด `COMPANY_PORTAL_DB_TESTS=1`
- integration tests ใช้ schema ชื่อสุ่มแยกจาก public และลบทิ้งเมื่อจบ ตรวจ approval concurrency และ transaction rollback จริง
- HTTP tests ใช้ production build กับฐานใหม่ชื่อ `company_portal_http_<uuid>` บนพอร์ต 3015 ตรวจสมัคร/เข้าสู่ระบบ/สิทธิ์/แก้ร่าง/ส่งใหม่/ปฏิเสธ/เผยแพร่/รายการสาธารณะ/เอกสาร/anonymous regression จริง **52 checks ผ่าน** รวม public detail API ที่ตอบ 404 ก่อนเผยแพร่และ 200 หลังอนุมัติ และการปฏิเสธ payload เกินขนาด ผลล่าสุดอยู่ใน `output/company-portal/http-test-results.json`
- UI Playwright: เข้าสู่ระบบและสมัครผ่านฟอร์มจริงในฐานทดสอบ, desktop 1440px / mobile 390px, ไม่ล้นจอ, ฟอร์มไม่มี field ที่ขาด label, ปุ่มกลับสู่สถานะปกติหลังส่ง, logout/expiry denial และ empty state ทำงาน
- anonymous initial state ตอบ 401 จาก private API ตามที่ออกแบบ ไม่ใช่ exception ของ UI; console ไม่มีข้อผิดพลาดอื่นนอกจาก expected unauthenticated requests
- `npm run lint` ยังหยุดที่ interactive ESLint setup ของ repository เดิม ไม่มี config ที่รันตรวจได้ จึงไม่อ้างว่า lint ผ่าน
- ทดสอบ HTTP และ temporary databases มี cleanup; อย่าเปิดใช้ `COMPANY_PORTAL_HOLD` ใน CI ถ้าไม่ได้ส่ง newline เพื่อจบ

## 7. Bug Audit

| Bug / Issue | Severity | Root Cause | Fix | Verification |
|---|---|---|---|---|
| เลือกอีเมล/ADMIN เองผ่าน simulator | Critical | เชื่อ role และอีเมลจาก client | secure credential + DB session; legacy simulator redirect | forged-role validation, unauthorized review HTTP 401/403 |
| เรียก CMS server action เพื่อแก้ public data โดยไม่ login | Critical | ไม่มี server-side guard | requireCompanyAdmin ในทุก privileged mutation | ตรวจโค้ดทุก exported mutator, unauthorized endpoint tests |
| รายชื่อ/อีเมลผู้ใช้และประวัติคนอื่นเปิดสาธารณะ | High | profile แสดงผู้ใช้ทั้งหมดและเชื่อ user_email | profile/session ของตน; database browser จำกัดสิทธิ์ | anonymous HTTP profile/database regression |
| อนุมัติซ้ำพร้อมกัน | High | อ่านสถานะแล้วเขียนโดยไม่มี lock | advisory lock + FOR UPDATE + version/status guard | concurrent HTTP ตอบ 200/409 อย่างละหนึ่ง; public robot หนึ่งแถว |
| ข้อเสนอเก่าทับข้อมูลใหม่ | High | ไม่มี baseline/version | published profile revision และ robot updatedAt baseline | stale proposal 409; concurrent updates สำเร็จหนึ่งรายการ |
| approval สำเร็จครึ่งเดียวเมื่อ DB ล้มเหลว | High | publication/status แยก commit | transaction รวมข้อมูล ประวัติ และสถานะ | simulated failure rollback หุ่นยนต์และสถานะครบ |
| seed sync ทับข้อมูลที่อนุมัติ/ตรวจแล้ว | High | background importer upsert ทุกฟิลด์ | row lock และ skip curated/company metadata | seed-protection regression test |
| ภาพ optional ว่างทำให้ validation throw แทนผล 422 | Medium | refine เรียก new URL ก่อนตรวจค่าว่าง | guard ก่อน parse | empty image regression + full lifecycle ผ่าน |
| Prisma อ่านผล void ของ advisory lock ไม่ได้ | Medium | ใช้ queryRaw deserialize void | executeRaw สำหรับ lock | full DB tests และ HTTP approval ผ่าน |
| private contributions ใน browser/listing เดิม | High | query ไม่กรอง visibility | public-only filters และ owner/admin scopes | public listing regression + separate draft storage |

## 8. Remaining Limitations

- DOI ตรวจรูปแบบและการซ้ำ ไม่เรียกผู้ให้บริการภายนอกเพื่อยืนยัน bibliographic metadata ผู้ดูแลต้องเปิดต้นฉบับตรวจผู้เขียน ผล และความสัมพันธ์เอง
- ภาพเป็น URL HTTPS PNG/JPG/WebP ไม่รับอัปโหลด ไม่มีไฟล์เอกสาร executable เข้า server; external images อาจหาย/ถูกเปลี่ยนภายหลังและอาจมี tracking จาก publisher
- ยังไม่มี email verification, password reset, SSO, invitation flow, automated membership revocation UI, email notifications หรือ document OCR
- บัญชี User เดิมที่ไม่มี CompanyAccount สมัครทับอีเมลเดิมไม่ได้ เพื่อป้องกัน account takeover ต้องให้แอดมินช่วย provision/recover แบบตรวจตัวตนก่อน; admin bootstrap ผ่าน environment ที่ถูกต้องรองรับแล้ว
- โปรไฟล์ที่ Next.js stream แล้วเรียก notFound อาจได้ HTTP 200 พร้อมหน้า not-found แต่ไม่ส่งข้อมูลร่าง; public detail API ตอบ 404 จริงสำหรับรายการที่ยังไม่เผยแพร่
- วันก่อนมี default admin credentials ในโค้ดเดิม ควรใช้ค่าแอดมินเฉพาะ environment ที่ปลอดภัยและเปลี่ยนค่าที่เคยเปิดเผยก่อนเปิดระบบต่อสาธารณะ
- ไม่ทำ penetration test ภายนอกหรืออ้างว่าเป็น security certification ไม่ยืนยัน claim วิทยาศาสตร์หรือสิทธิ์ภาพแทนผู้ดูแล

## 9. How to Test

1. เปิด `/company` → สมัครบัญชีด้วยอีเมลใหม่และรหัสผ่านอย่างน้อย 12 ตัวอักษร
2. ส่งชื่อ/เว็บไซต์บริษัท อีเมลธุรกิจ และหลักฐานสิทธิ์เป็นตัวแทน จะเห็นสถานะรอตรวจ ยังสร้างข้อเสนอบริษัทไม่ได้
3. อีก browser/session เข้าสู่ `/company` ด้วย admin environment credentials → `/company-review`
4. ตรวจหลักฐาน ใส่เหตุผล ติ๊กยืนยันความสัมพันธ์/ตัวแทน แล้วอนุมัติคำขอ (หรือขอข้อมูลเพิ่มเติม/ปฏิเสธ)
5. ตัวแทนโหลดใหม่ สร้างโปรไฟล์ฉบับร่าง → ส่งตรวจ ระหว่างนี้ `/companies` ยังไม่เผยแพร่
6. แอดมินอนุมัติโปรไฟล์ → โปรไฟล์สาธารณะปรากฏ จากนั้นส่งหุ่นยนต์หรือเอกสารด้วยหลักฐานจริง
7. ตรวจว่าร่าง/รอตรวจ/ปฏิเสธไม่เพิ่มแถว public; อนุมัติแล้วจึงปรากฏใน `/robots`, `/robots/[id]`, `/contributions` และ `/companies/[id]`
8. เสนอแก้รายการเดิมด้วย ID โดยสร้างข้อเสนอใหม่ ข้อมูลเก่ายังอยู่ระหว่างตรวจ ถ้าระเบียนเดิมเปลี่ยนหลังสร้างร่าง การอนุมัติต้องถูกปฏิเสธ 409
9. เข้าสู่ระบบบัญชีอื่นแล้วลองส่ง companyId หรือ submissionId ของคนอื่น ต้องถูกปฏิเสธ อย่าทดสอบด้วยข้อมูลบริษัทสมมติในฐานจริง

รัน HTTP test หลัง build เพื่อทดสอบ fixture ครบวงจรในฐานทิ้งได้เท่านั้น ต้องมีสิทธิ์สร้าง/ลบฐานทดสอบ พอร์ต 3015 ต้องว่าง หากใช้ `COMPANY_PORTAL_HOLD=1` ให้ส่ง newline ทาง stdin หลังตรวจ browser เพื่อให้ cleanup บน Windows ทำงาน

## 10. Final Status

**Implemented with limitations — ใช้งาน workflow หลักและตรวจด้วย unit / isolated integration / HTTP / browser จริงแล้ว**

ขอบเขตที่ไม่ทำคืออัปโหลด/ยืนยัน DOI อัตโนมัติและการกู้บัญชีด้วยอีเมล ไม่ได้ข้ามการตรวจสิทธิ์หรือเผยแพร่ข้อมูลระหว่างรออนุมัติ
