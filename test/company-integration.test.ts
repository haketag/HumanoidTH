import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { companyCommand, portalState, reviewState } from '../lib/company-service';
import { commandSchema } from '../lib/company-validation';
import { hashPassword, passwordMatches, PortalError, type Actor, type CompanyTransaction } from '../lib/company-auth';

test('Company Portal lifecycle, isolation, publication, rollback and concurrent review', {skip:process.env.COMPANY_PORTAL_DB_TESTS!=='1',timeout:120000}, async()=>{
  const schema=`company_portal_test_${randomUUID().replace(/-/g,'')}`;
  assert.match(schema,/^company_portal_test_[a-f0-9]{32}$/);
  async function db<T>(fn:(tx:CompanyTransaction)=>Promise<T>) {return prisma.$transaction(async tx=>{await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);return fn(tx);},{timeout:20000,maxWait:20000});}
  const alice:Actor={id:randomUUID(),email:'alice@company-test.invalid',name:'Test Alice',isAdmin:false};
  const bob:Actor={id:randomUUID(),email:'bob@company-test.invalid',name:'Test Bob',isAdmin:false};
  const admin:Actor={id:randomUUID(),email:'admin@company-test.invalid',name:'Test Admin',isAdmin:true};
  const secondAdmin:Actor={...admin,id:randomUUID(),email:'second@company-test.invalid'};
  const run=(actor:Actor|null,value:unknown)=>db(tx=>companyCommand(tx,actor,commandSchema.parse(value)));
  const review=(id:string,version:number,target='submission',decision='APPROVED',verifiedRelationship=true,actor=admin)=>run(actor,{action:'review',id,version,target,decision,feedback:'Evidence checked in isolated automated test',verifiedRelationship});
  const fail=(work:()=>Promise<unknown>,status:number)=>assert.rejects(work,e=>e instanceof PortalError && e.status===status);
  let created=false;
  try {
    await prisma.$transaction(async tx=>{
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      for(const file of ['prisma/migrations/20260703081551_init/migration.sql','prisma/migrations/20261102000100_company_portal/migration.sql']) {
        for(const statement of readFileSync(file,'utf8').split(';').map(s=>s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      }
      for(const actor of [alice,bob,admin,secondAdmin]) await tx.$executeRaw`INSERT INTO "User"(id,email,name,"updatedAt") VALUES (${actor.id},${actor.email},${actor.name},NOW())`;
    },{timeout:30000});created=true;
    const password=await hashPassword('isolated-test-password-123');assert.ok(await passwordMatches('isolated-test-password-123',password));assert.equal(await passwordMatches('wrong-test-password',password),false);
    const access={action:'access',data:{name:'Isolated Test Robotics',website:'https://company-test.example.com',businessEmail:alice.email,evidence:'An isolated test verifies representation manually; no production company is created.'}};
    await fail(()=>run(null,access),401);
    const companyId=(await run(alice,access) as {companyId:string}).companyId;
    const duplicate=(await run(bob,{...access,data:{...access.data,businessEmail:bob.email}}) as {companyId:string}).companyId;assert.equal(duplicate,companyId);
    const member=await db(async tx=>(await tx.$queryRaw<{id:string;version:number}[]>`SELECT id,version FROM "CompanyMembership" WHERE "userId"=${alice.id}`)[0]);
    const profile={name:'Isolated Test Robotics',website:access.data.website,description:'Isolated example used only in a temporary test schema',contactEmail:alice.email,contact:'',logoUrl:''};
    await fail(()=>run(alice,{action:'draft',companyId,kind:'PROFILE',proposed:profile}),403);
    await fail(()=>review(member.id,1,'membership','APPROVED',true,alice),403);
    await fail(()=>review(member.id,1,'membership','APPROVED',false),422);
    await review(member.id,1,'membership','CHANGES_REQUESTED');
    await run(alice,{action:'resubmitAccess',id:member.id,version:2,evidence:'Additional representation evidence from isolated test fixture.'});
    await review(member.id,3,'membership');
    const otherCompany=(await run(bob,{action:'access',data:{name:'Other Isolated Robotics',website:'https://other-company-test.example.com',businessEmail:bob.email,evidence:'Independent representation fixture for another isolated company.'}}) as {companyId:string}).companyId;
    const otherMember=(await db(tx=>tx.$queryRaw<{id:string}[]>`SELECT id FROM "CompanyMembership" WHERE "companyId"=${otherCompany} AND "userId"=${bob.id}`))[0];
    await review(otherMember.id,1,'membership');
    await fail(()=>run(bob,{action:'draft',companyId,kind:'PROFILE',proposed:profile}),403);
    await fail(()=>run(alice,{action:'draft',companyId:otherCompany,kind:'PROFILE',proposed:profile}),403);
    await fail(()=>db(tx=>reviewState(tx,bob)),403);
    const draft=async(kind:string,proposed:unknown,targetRobotId?:string)=>(await run(alice,{action:'draft',companyId,kind,proposed,...(targetRobotId ? {targetRobotId} : {})}) as {id:string}).id;
    const submit=(id:string,version=1)=>run(alice,{action:'submit',id,version});
    const profileId=await draft('PROFILE',profile);
    assert.equal((await db(tx=>tx.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM "Company" WHERE published IS NOT NULL`))[0].count,0n);
    await fail(()=>run(bob,{action:'save',id:profileId,version:1,proposed:profile}),403);
    await submit(profileId);await review(profileId,2);
    const updateProfile=await draft('PROFILE',{...profile,description:'This text must remain private while pending review.'});await submit(updateProfile);
    const published=await db(tx=>tx.$queryRaw<{published:typeof profile}[]>`SELECT published FROM "Company" WHERE id=${companyId}`);assert.equal(published[0].published.description,profile.description);
    await review(updateProfile,2,'submission','CHANGES_REQUESTED');
    await run(alice,{action:'save',id:updateProfile,version:3,proposed:{...profile,description:'Updated after requested changes, still a private draft.'}});await submit(updateProfile,4);await review(updateProfile,5,'submission','REJECTED');
    assert.equal((await db(tx=>tx.$queryRaw<{published:typeof profile}[]>`SELECT published FROM "Company" WHERE id=${companyId}`))[0].published.description,profile.description);
    const robot={name:'Isolated Alpha Robot',description:'Manufacturer-reported isolated test model description.',robotType:'service_robot',officialUrl:'https://company-test.example.com/alpha',sources:['https://company-test.example.com/alpha'],imageUrl:'',capabilities:[{claim:'Example source-supported claim',source:'https://company-test.example.com/manual'}]};
    const rejected=await draft('ROBOT',{...robot,name:'Rejected Isolated Robot'});await submit(rejected);await review(rejected,2,'submission','REJECTED');
    assert.equal((await db(tx=>tx.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM "RobotModel"`))[0].count,0n);
    const robotSubmission=await draft('ROBOT',robot);await submit(robotSubmission);
    const simultaneous=await Promise.allSettled([review(robotSubmission,2),review(robotSubmission,2,'submission','APPROVED',true,secondAdmin)]);
    assert.equal(simultaneous.filter(r=>r.status==='fulfilled').length,1);assert.equal(simultaneous.filter(r=>r.status==='rejected').length,1);
    const publicRobot=(await db(tx=>tx.$queryRaw<{id:string;sourceMeta:Record<string,unknown>}[]>`SELECT id,"sourceMeta" FROM "RobotModel"`))[0];assert.ok(publicRobot.sourceMeta.companySubmission);
    await fail(()=>run(alice,{action:'save',id:robotSubmission,version:3,proposed:robot}),409);
    const research={title:'Isolated technical document',authors:'Isolated fixture authors',description:'Isolated document reference; no real publication is invented.',sourceUrl:'https://company-test.example.com/manual',documentType:'technical_document',doi:'',robotId:'',relationshipEvidence:''};
    const researchId=await draft('RESEARCH',research);await submit(researchId);await review(researchId,2);
    const contribution=(await db(tx=>tx.$queryRaw<{relatedRobotModelId:string|null}[]>`SELECT "relatedRobotModelId" FROM "Contribution"`))[0];assert.equal(contribution.relatedRobotModelId,null);
    const researchDuplicate=await draft('RESEARCH',research);await submit(researchDuplicate);await fail(()=>review(researchDuplicate,2),409);
    const stale=await draft('ROBOT',{...robot,description:'This stale description must never be published.'},publicRobot.id);await submit(stale);
    await db(tx=>tx.$executeRaw`UPDATE "RobotModel" SET description='Newer independent public edit',"sourceMeta"="sourceMeta" || '{"preservedResearch":"keep"}'::jsonb,"updatedAt"=NOW() WHERE id=${publicRobot.id}`);
    await fail(()=>review(stale,2),409);
    const first=await draft('ROBOT',{...robot,description:'First concurrent update with explicit review.'},publicRobot.id);const second=await draft('ROBOT',{...robot,description:'Second concurrent update with explicit review.'},publicRobot.id);await submit(first);await submit(second);
    const edits=await Promise.allSettled([review(first,2),review(second,2,'submission','APPROVED',true,secondAdmin)]);assert.equal(edits.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await db(tx=>tx.$queryRaw<{sourceMeta:Record<string,unknown>}[]>`SELECT "sourceMeta" FROM "RobotModel" WHERE id=${publicRobot.id}`))[0].sourceMeta.preservedResearch,'keep');
    const broken=await draft('ROBOT',{...robot,name:'Rollback-only Robot'});await submit(broken);
    const marker=new Error('Simulated failure before commit');
    await assert.rejects(()=>db(async tx=>{await companyCommand(tx,admin,commandSchema.parse({action:'review',id:broken,version:2,target:'submission',decision:'APPROVED',feedback:'Simulated atomic rollback test',verifiedRelationship:true}));throw marker;}),error=>error===marker);
    assert.equal((await db(tx=>tx.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM "RobotModel" WHERE "canonicalName"='Rollback-only Robot'`))[0].count,0n);
    assert.equal((await db(tx=>tx.$queryRaw<{status:string}[]>`SELECT status FROM "CompanySubmission" WHERE id=${broken}`))[0].status,'PENDING_REVIEW');
    const privateState=await db(tx=>portalState(tx,bob));assert.equal((privateState.submissions as unknown[]).length,0);
    assert.equal((await db(tx=>tx.$queryRaw<{count:bigint}[]>`SELECT count(*) FROM "Company" WHERE domain='company-test.example.com'`))[0].count,1n);
    console.log('Company Portal: unauthorized, cross-company, forged-role validation, changes/resubmit/reject, private drafts, linked research, stale edit, concurrent approvals and rollback checked in isolated schema.');
  } finally {
    if(created) await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await prisma.$disconnect();
  }
});
