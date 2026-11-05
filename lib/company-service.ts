import { randomUUID } from 'node:crypto';
import { authorizeAdmin, PortalError, type Actor, type CompanyTransaction } from './company-auth';
import { companyKey, companyDomain, profileData, robotData, researchData, validateProposal, type CompanyCommand, type ProposalKind } from './company-validation';

type Company = {id:string;name:string;nameKey:string;website:string;domain:string;revision:number;published:unknown;entityId:string|null};
type Membership = {id:string;userId:string;companyId:string;status:string;version:number};
export type Submission = {id:string;companyId:string;userId:string;kind:ProposalKind;status:string;version:number;targetRobotId:string|null;proposed:unknown;baseline:{revision?:number;robotUpdatedAt?:string;previousPublished?:unknown};publicId:string|null};
export function requireActor(actor: Actor | null): asserts actor is Actor { if(!actor) throw new PortalError(401,'กรุณาเข้าสู่ระบบ'); }
export function checkEditable(submission: Pick<Submission,'userId'|'status'|'version'>, actor:Actor, version:number) {
  if(submission.userId!==actor.id) throw new PortalError(403,'ไม่มีสิทธิ์แก้ไขฉบับร่างนี้');
  if(!['DRAFT','CHANGES_REQUESTED'].includes(submission.status)) throw new PortalError(409,'รายการนี้แก้ไขไม่ได้ กรุณาสร้างข้อเสนอใหม่');
  if(submission.version!==version) throw new PortalError(409,'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่');
}
async function membership(tx:CompanyTransaction,actor:Actor,companyId:string) {
  const rows=await tx.$queryRaw<Membership[]>`SELECT * FROM "CompanyMembership" WHERE "companyId"=${companyId} AND "userId"=${actor.id} AND status='APPROVED' FOR SHARE`;
  if(!rows.length) throw new PortalError(403,'ยังไม่ได้รับสิทธิ์จัดการบริษัทนี้');
}
async function company(tx:CompanyTransaction,id:string) {
  const rows=await tx.$queryRaw<Company[]>`SELECT * FROM "Company" WHERE id=${id} FOR UPDATE`;
  if(!rows[0]) throw new PortalError(404,'ไม่พบบริษัท');
  return rows[0];
}
async function assertRobotRelationship(tx:CompanyTransaction,companyId:string,robotId:string) {
  const owners=await tx.$queryRaw<{companyId:string}[]>`SELECT "companyId" FROM "CompanyRobot" WHERE "robotId"=${robotId}`;
  if(owners.length && owners[0].companyId!==companyId) throw new PortalError(403,'หุ่นยนต์นี้เชื่อมกับบริษัทอื่นแล้ว');
}
async function checkResearch(tx:CompanyTransaction,companyId:string,value:unknown) {
  const p=researchData.parse(value);
  if(p.robotId) {
    const linked=await tx.$queryRaw`SELECT 1 FROM "CompanyRobot" WHERE "companyId"=${companyId} AND "robotId"=${p.robotId}`;
    if(!(linked as unknown[]).length) throw new PortalError(403,'เลือกได้เฉพาะหุ่นยนต์ที่อนุมัติความสัมพันธ์กับบริษัทแล้ว');
  }
  return p;
}

export async function companyCommand(tx:CompanyTransaction,actor:Actor|null,command:CompanyCommand) {
  requireActor(actor);
  if(command.action==='access') {
    const p=command.data; const nameKey=companyKey(p.name),domain=companyDomain(p.website);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('company-access'))`;
    const existing=await tx.$queryRaw<Company[]>`SELECT * FROM "Company" WHERE "nameKey"=${nameKey} OR domain=${domain}`;
    if(existing.length>1 || (existing.length && (existing[0].domain!==domain || existing[0].nameKey!==nameKey))) throw new PortalError(409,'ชื่อหรือเว็บไซต์ตรงกับบริษัทที่มีอยู่ กรุณาใช้ชื่อและเว็บไซต์จากรายการบริษัท');
    const id=existing[0]?.id || randomUUID();
    if(!existing.length) await tx.$executeRaw`INSERT INTO "Company" (id,name,"nameKey",website,domain) VALUES (${id},${p.name},${nameKey},${p.website},${domain})`;
    const previous=await tx.$queryRaw`SELECT id FROM "CompanyMembership" WHERE "companyId"=${id} AND "userId"=${actor.id}`;
    if((previous as unknown[]).length) throw new PortalError(409,'มีคำขอสำหรับบริษัทนี้แล้ว กรุณาดูสถานะ');
    await tx.$executeRaw`INSERT INTO "CompanyMembership" (id,"companyId","userId","businessEmail",evidence) VALUES (${randomUUID()},${id},${actor.id},${p.businessEmail},${p.evidence})`;
    return {companyId:id};
  }
  if(command.action==='resubmitAccess') {
    const result=await tx.$executeRaw`UPDATE "CompanyMembership" SET evidence=${command.evidence},status='PENDING_REVIEW',version=version+1 WHERE id=${command.id} AND "userId"=${actor.id} AND version=${command.version} AND status='CHANGES_REQUESTED'`;
    if(!result) throw new PortalError(409,'คำขอเปลี่ยนไปแล้วหรือไม่มีสิทธิ์แก้ไข');
    return {ok:true};
  }
  if(command.action==='draft') {
    await membership(tx,actor,command.companyId);
    const c=await company(tx,command.companyId);
    const p=validateProposal(command.kind,command.proposed);
    const baseline:Submission['baseline']={revision:c.revision,previousPublished:c.published};
    if(command.targetRobotId && command.kind!=='ROBOT') throw new PortalError(422,'ชนิดข้อเสนอไม่ตรงกับเป้าหมาย');
    if(command.targetRobotId) {
      await assertRobotRelationship(tx,c.id,command.targetRobotId);
      const robots=await tx.$queryRaw<{updatedAt:Date}[]>`SELECT * FROM "RobotModel" WHERE id=${command.targetRobotId} FOR SHARE`;
      if(!robots[0]) throw new PortalError(404,'ไม่พบหุ่นยนต์เดิม');
      baseline.robotUpdatedAt=robots[0].updatedAt.toISOString();
      baseline.previousPublished=robots[0];
    }
    if(command.kind==='RESEARCH') await checkResearch(tx,c.id,p);
    const id=randomUUID();
    await tx.$executeRaw`INSERT INTO "CompanySubmission" (id,"companyId","userId",kind,proposed,baseline,"targetRobotId") VALUES (${id},${c.id},${actor.id},${command.kind},${JSON.stringify(p)}::jsonb,${JSON.stringify(baseline)}::jsonb,${command.targetRobotId || null})`;
    return {id};
  }
  if(command.action==='review') {
    authorizeAdmin(actor);
    // Serialize publication across organizations to handle duplicate names and double approvals.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('company-publication'))`;
    if(command.target==='membership') {
      const rows=await tx.$queryRaw<Membership[]>`SELECT * FROM "CompanyMembership" WHERE id=${command.id} FOR UPDATE`;
      const row=rows[0];
      if(!row || row.status!=='PENDING_REVIEW' || row.version!==command.version) throw new PortalError(409,'คำขอนี้ถูกตรวจแล้วหรือมีการเปลี่ยนแปลง');
      if(command.decision==='APPROVED' && !command.verifiedRelationship) throw new PortalError(422,'ต้องยืนยันว่าได้ตรวจสิทธิ์เป็นตัวแทนบริษัทด้วยหลักฐานแล้ว');
      await tx.$executeRaw`UPDATE "CompanyMembership" SET status=${command.decision},feedback=${command.feedback},version=version+1 WHERE id=${row.id}`;
      await tx.$executeRaw`INSERT INTO "CompanyReview" (id,"membershipId","actorId",decision,feedback,snapshot) VALUES (${randomUUID()},${row.id},${actor.id},${command.decision},${command.feedback},${JSON.stringify(row)}::jsonb)`;
      return {ok:true};
    }
    const rows=await tx.$queryRaw<Submission[]>`SELECT * FROM "CompanySubmission" WHERE id=${command.id} FOR UPDATE`;
    const s=rows[0];
    if(!s || s.status!=='PENDING_REVIEW' || s.version!==command.version) throw new PortalError(409,'ข้อเสนอนี้ถูกตรวจแล้วหรือมีการเปลี่ยนแปลง');
    const p=validateProposal(s.kind,s.proposed);
    let publicId=s.publicId;
    if(command.decision==='APPROVED') {
      // Authorization must still exist at publication, not only at draft creation.
      await membership(tx,{...actor,id:s.userId},s.companyId);
      const c=await company(tx,s.companyId);
      if(s.kind==='PROFILE') {
        const profile=profileData.parse(p);
        if(c.revision!==s.baseline.revision) throw new PortalError(409,'โปรไฟล์สาธารณะเปลี่ยนแล้ว กรุณาสร้างข้อเสนอจากข้อมูลล่าสุด');
        const domain=companyDomain(profile.website),key=companyKey(profile.name);
        const duplicates=await tx.$queryRaw`SELECT id FROM "Company" WHERE id<>${c.id} AND (domain=${domain} OR "nameKey"=${key})`;
        if((duplicates as unknown[]).length) throw new PortalError(409,'ซ้ำกับชื่อหรือเว็บไซต์ของบริษัทอื่น');
        const entityKey=`company:${domain}`;
        const entities=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Entity" WHERE "canonicalKey"=${entityKey} OR ("entityType" IN ('organization','company','manufacturer') AND lower(trim(name))=${key})`;
        if(entities.length>1) throw new PortalError(409,'พบองค์กรเดิมมากกว่าหนึ่งรายการ ต้องตรวจข้อมูลซ้ำก่อน');
        const entityId=c.entityId || entities[0]?.id || randomUUID();
        await tx.$executeRaw`INSERT INTO "Entity" (id,name,"entityType","canonicalKey","sourceMeta") VALUES (${entityId},${profile.name},'organization',${entityKey},${JSON.stringify({website:profile.website,companyId:c.id})}::jsonb) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,"sourceMeta"="Entity"."sourceMeta" || EXCLUDED."sourceMeta"`;
        await tx.$executeRaw`UPDATE "Company" SET name=${profile.name},"nameKey"=${key},website=${profile.website},domain=${domain},published=${JSON.stringify(profile)}::jsonb,revision=revision+1,"entityId"=${entityId} WHERE id=${c.id}`;
        publicId=c.id;
      } else {
        if(!c.published) throw new PortalError(409,'ต้องอนุมัติโปรไฟล์บริษัทก่อนเผยแพร่หุ่นยนต์หรือผลงาน');
        if(s.kind==='ROBOT') {
          if(!command.verifiedRelationship) throw new PortalError(422,'ต้องยืนยันความสัมพันธ์ผู้ผลิต/ผู้พัฒนาด้วยหลักฐานก่อน');
          const robot=robotData.parse(p);
          const duplicate=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "RobotModel" WHERE lower(trim("canonicalName"))=${companyKey(robot.name)} AND id<>${s.targetRobotId || ''}`;
          if(duplicate.length) throw new PortalError(409,'พบหุ่นยนต์ชื่อเดียวกัน กรุณาเสนอแก้ไขรายการเดิม');
          const id=s.targetRobotId || randomUUID();
          if(s.targetRobotId) {
            await assertRobotRelationship(tx,c.id,id);
            const current=await tx.$queryRaw<{updatedAt:Date}[]>`SELECT "updatedAt" FROM "RobotModel" WHERE id=${id} FOR UPDATE`;
            if(!current[0] || current[0].updatedAt.toISOString()!==s.baseline.robotUpdatedAt) throw new PortalError(409,'ข้อมูลหุ่นยนต์เปลี่ยนหลังส่งข้อเสนอ กรุณาสร้างข้อเสนอใหม่');
          }
          const meta={companySubmission:{id:s.id,companyId:c.id,submittedByOrganization:c.name,claimedManufacturer:c.name,relationshipReviewedBy:actor.id,sources:robot.sources,modelIdentifier:robot.modelIdentifier,specifications:robot.specifications,capabilities:robot.capabilities,claimStatus:'manufacturer_reported_not_independently_validated'},sourceReview:{status:'admin_approved_company_submission',sourceUrl:robot.officialUrl,checkedAt:new Date().toISOString(),notes:'Company-supplied information reviewed for publication. Capability claims are not independently validated.'},...(robot.imageUrl ? {imageUrl:robot.imageUrl,imageOriginalUrl:robot.imageUrl,imageSourceUrl:robot.officialUrl,imageCredit:`Submitted by ${c.name}`,imageCaption:`Company-supplied image: ${robot.name}`,imageRights:'Company-supplied image; rights must be checked by the reviewing administrator.'} : {})};
          if(s.targetRobotId) await tx.$executeRaw`UPDATE "RobotModel" SET "canonicalName"=${robot.name},description=${robot.description},"robotType"=${robot.robotType},"officialUrl"=${robot.officialUrl},"sourceMeta"=(CASE WHEN ${!!robot.imageUrl} THEN "sourceMeta" - 'imageSha256' ELSE "sourceMeta" END) || ${JSON.stringify(meta)}::jsonb,"updatedAt"=NOW() WHERE id=${id}`;
          else await tx.$executeRaw`INSERT INTO "RobotModel" (id,"canonicalName",manufacturer,"developerOrg",description,"robotType","officialUrl","sourceMeta","updatedAt") VALUES (${id},${robot.name},${c.name},${c.name},${robot.description},${robot.robotType},${robot.officialUrl},${JSON.stringify(meta)}::jsonb,NOW())`;
          await tx.$executeRaw`INSERT INTO "CompanyRobot" ("companyId","robotId") VALUES (${c.id},${id}) ON CONFLICT("robotId") DO NOTHING`;
          for(const source of robot.sources) await tx.$executeRaw`INSERT INTO "SourceRecord" (id,"sourceType",title,url,excerpt,"rawMeta","updatedAt") VALUES (${randomUUID()},'SUBMISSION',${robot.name},${source},'',${JSON.stringify({companyId:c.id,submissionId:s.id,kind:'company_supplied_source'})}::jsonb,NOW()) ON CONFLICT(url) DO NOTHING`;
          publicId=id;
        } else {
          const research=await checkResearch(tx,c.id,p);
          const canonicalSource=research.doi ? `https://doi.org/${research.doi.toLowerCase()}` : research.sourceUrl;
          const duplicate=await tx.$queryRaw`SELECT id FROM "Contribution" WHERE lower("sourceUrl") IN (${canonicalSource.toLowerCase()},${research.sourceUrl.toLowerCase()})`;
          if((duplicate as unknown[]).length) throw new PortalError(409,'มีผลงานที่ใช้ลิงก์หรือ DOI นี้แล้ว');
          publicId=randomUUID();
          await tx.$executeRaw`INSERT INTO "Contribution" (id,"contributorName","contributorType",organization,"contributionType",title,description,"relatedRobotModelId","sourceUrl",visibility,"verificationStatus","updatedAt") VALUES (${publicId},${research.authors},'company_submission',${c.name},${research.documentType},${research.title},${research.description+'\nSubmitted by '+c.name+'. Reference reviewed for publication; not independent validation of capability. Relationship source: '+(research.relationshipEvidence || 'No robot relationship claimed')},${research.robotId || null},${canonicalSource},'public','APPROVED',NOW())`;
          await tx.$executeRaw`INSERT INTO "SourceRecord" (id,"sourceType",title,url,excerpt,"rawMeta","updatedAt") VALUES (${randomUUID()},'SUBMISSION',${research.title},${research.sourceUrl},'',${JSON.stringify({companyId:c.id,submissionId:s.id,documentType:research.documentType,doi:research.doi,relationshipEvidence:research.relationshipEvidence,claimStatus:'company_supplied_reference'})}::jsonb,NOW()) ON CONFLICT(url) DO NOTHING`;
        }
      }
    }
    await tx.$executeRaw`UPDATE "CompanySubmission" SET status=${command.decision},feedback=${command.feedback},"publicId"=${publicId},version=version+1,"updatedAt"=NOW() WHERE id=${s.id}`;
    await tx.$executeRaw`INSERT INTO "CompanyReview" (id,"submissionId","actorId",decision,feedback,snapshot) VALUES (${randomUUID()},${s.id},${actor.id},${command.decision},${command.feedback},${JSON.stringify({proposed:p,baseline:s.baseline,verifiedRelationship:command.verifiedRelationship,publicId})}::jsonb)`;
    return {publicId};
  }
  const rows=await tx.$queryRaw<Submission[]>`SELECT * FROM "CompanySubmission" WHERE id=${command.id} FOR UPDATE`;
  const s=rows[0];
  if(!s) throw new PortalError(404,'ไม่พบข้อเสนอ');
  await membership(tx,actor,s.companyId);
  checkEditable(s,actor,command.version);
  if(command.action==='save') {
    const p=validateProposal(s.kind,command.proposed);
    if(s.kind==='RESEARCH') await checkResearch(tx,s.companyId,p);
    await tx.$executeRaw`UPDATE "CompanySubmission" SET proposed=${JSON.stringify(p)}::jsonb,status='DRAFT',version=version+1,"updatedAt"=NOW() WHERE id=${s.id}`;
  } else {
    validateProposal(s.kind,s.proposed);
    await tx.$executeRaw`UPDATE "CompanySubmission" SET status='PENDING_REVIEW',"submittedAt"=NOW(),"updatedAt"=NOW(),version=version+1 WHERE id=${s.id}`;
  }
  return {ok:true};
}

export async function portalState(tx:CompanyTransaction,actor:Actor) {
  const memberships=await tx.$queryRaw`SELECT m.*,c.name,c.website,c.published,c.revision FROM "CompanyMembership" m JOIN "Company" c ON c.id=m."companyId" WHERE m."userId"=${actor.id} ORDER BY m."createdAt" DESC`;
  const submissions=await tx.$queryRaw`SELECT s.* FROM "CompanySubmission" s JOIN "CompanyMembership" m ON m."companyId"=s."companyId" WHERE m."userId"=${actor.id} AND m.status='APPROVED' AND s."userId"=${actor.id} ORDER BY s."updatedAt" DESC LIMIT 200`;
  const robots=await tx.$queryRaw`SELECT r.id,r."canonicalName",l."companyId" FROM "RobotModel" r JOIN "CompanyRobot" l ON l."robotId"=r.id JOIN "CompanyMembership" m ON m."companyId"=l."companyId" WHERE m."userId"=${actor.id} AND m.status='APPROVED'`;
  const research=await tx.$queryRaw`SELECT c.id,c.title,c."sourceUrl",s."companyId" FROM "Contribution" c JOIN "CompanySubmission" s ON s."publicId"=c.id JOIN "CompanyMembership" m ON m."companyId"=s."companyId" WHERE m."userId"=${actor.id} AND m.status='APPROVED' AND s.kind='RESEARCH' AND s.status='APPROVED'`;
  return {memberships,submissions,robots,research};
}

export async function reviewState(tx:CompanyTransaction,actor:Actor) {
  authorizeAdmin(actor);
  const memberships=await tx.$queryRaw`SELECT m.*,c.name,c.website,u.name AS "representativeName",u.email FROM "CompanyMembership" m JOIN "Company" c ON c.id=m."companyId" JOIN "User" u ON u.id=m."userId" WHERE m.status='PENDING_REVIEW' ORDER BY m."createdAt" LIMIT 200`;
  const submissions=await tx.$queryRaw`SELECT s.*,c.name AS "companyName",c.published AS "currentProfile",row_to_json(r) AS "currentRobot" FROM "CompanySubmission" s JOIN "Company" c ON c.id=s."companyId" LEFT JOIN "RobotModel" r ON r.id=s."targetRobotId" WHERE s.status='PENDING_REVIEW' ORDER BY s."submittedAt" LIMIT 200`;
  const reviews=await tx.$queryRaw`SELECT id,"submissionId","membershipId","actorId",decision,feedback,"createdAt" FROM "CompanyReview" ORDER BY "createdAt" DESC LIMIT 100`;
  return {memberships,submissions,reviews};
}
