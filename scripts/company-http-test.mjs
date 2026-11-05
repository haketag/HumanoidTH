import 'dotenv/config';
import pg from 'pg';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {once} from 'node:events';

// All synthetic accounts and publications live in a disposable database, never the live atlas.
const name=`company_portal_http_${randomUUID().replace(/-/g,'')}`;
assert.match(name,/^company_portal_http_[a-f0-9]{32}$/);
const root=new pg.Client({connectionString:process.env.DATABASE_URL});await root.connect();
const url=new URL(process.env.DATABASE_URL);url.pathname=`/${name}`;
const base='http://localhost:3015';const results=[];let child,testDb,created=false;
async function request(cookie,body,expected=200,path='/api/company') {
  const response=await fetch(base+path,{method:body ? 'POST' : 'GET',headers:{...(body?{'Content-Type':'application/json',Origin:base}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const content=await response.text();let json;try{json=JSON.parse(content);}catch{json=null;}
  if(Array.isArray(expected)) assert.ok(expected.includes(response.status),`${body?.action || path}: HTTP ${response.status}`);
  else assert.equal(response.status,expected,`${body?.action || path}: ${content.slice(0,350)}`);
  const fresh=response.headers.getSetCookie().find(c=>c.startsWith('company_session='))?.split(';')[0];
  results.push({action:body?.action||path,status:response.status});return {json,text:content,cookie:fresh||cookie,status:response.status};
}
try {
  await root.query(`CREATE DATABASE "${name}"`);created=true;
  testDb=new pg.Client({connectionString:url.toString()});await testDb.connect();
  for(const file of ['prisma/migrations/20260703081551_init/migration.sql','prisma/migrations/20261102000100_company_portal/migration.sql']) await testDb.query(readFileSync(file,'utf8'));
  const adminPassword=randomUUID()+'A!';
  child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3015'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:url.toString(),ADMIN_BASIC_USER:'admin@portal-test.example.com',ADMIN_BASIC_PASSWORD:adminPassword},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let serverLog='';child.stdout.on('data',b=>{serverLog+=b.toString();});child.stderr.on('data',b=>{serverLog+=b.toString();});
  for(let i=0;i<60;i++){try{if((await fetch(base+'/company')).ok)break;}catch{}if(child.exitCode!==null)throw new Error(serverLog);await new Promise(r=>setTimeout(r,500));}
  await request('',{action:'draft',companyId:'unknown',kind:'PROFILE',proposed:{}},401);
  await request('',{action:'login',credentials:{email:'oversize@portal-test.example.com',password:'x'.repeat(70000)}},413);
  await request('admin_session=true; user_role=ADMIN',{action:'review',id:'unknown',version:1,target:'membership',decision:'APPROVED',feedback:'forged-admin',verifiedRelationship:true},401);
  const password='isolated-browser-test-password-123';
  const alice=await request('',{action:'register',credentials:{name:'Isolated Alice',email:'alice@portal-test.example.com',password}});
  const bob=await request('',{action:'register',credentials:{name:'Isolated Bob',email:'bob@portal-test.example.com',password}});
  await request(alice.cookie,null,403,'/api/company?view=review');
  const admin=await request('',{action:'login',credentials:{email:'admin@portal-test.example.com',password:adminPassword}});
  const access=await request(alice.cookie,{action:'access',data:{name:'Isolated HTTP Robotics',website:'https://portal-test.example.com',businessEmail:'alice@portal-test.example.com',evidence:'Fixture representation evidence, reviewed manually by an isolated admin.'}});
  const companyId=access.json.companyId;
  const profile={name:'Isolated HTTP Robotics',website:'https://portal-test.example.com',description:'Company fixture that must never appear in the live database.',logoUrl:'',contactEmail:'public@portal-test.example.com',contact:''};
  await request(alice.cookie,{action:'draft',companyId,kind:'PROFILE',proposed:profile},403);
  const queue=await request(admin.cookie,null,200,'/api/company?view=review');const member=queue.json.memberships[0];
  await request(alice.cookie,{action:'review',target:'membership',id:member.id,version:1,decision:'APPROVED',feedback:'Representative impersonation',verifiedRelationship:true},403);
  const review=(id,version,target='submission',decision='APPROVED')=>request(admin.cookie,{action:'review',id,version,target,decision,feedback:'Checked source and organization evidence in isolated HTTP test.',verifiedRelationship:true});
  await review(member.id,1,'membership');
  await request(bob.cookie,{action:'draft',companyId,kind:'PROFILE',proposed:profile},403);
  const draft=await request(alice.cookie,{action:'draft',companyId,kind:'PROFILE',proposed:profile});
  const privatePage=await request('',null,200,`/companies/${companyId}`);
  assert.ok(!privatePage.text.includes(profile.name));
  await request('',null,404,`/api/company?view=company&id=${companyId}`);
  assert.equal((await request('',null,200,'/api/company?view=companies')).json.companies.length,0);
  await request(alice.cookie,{action:'submit',id:draft.json.id,version:1});
  await review(draft.json.id,2,'submission','CHANGES_REQUESTED');
  await request(alice.cookie,{action:'save',id:draft.json.id,version:3,proposed:profile});
  await request(alice.cookie,{action:'submit',id:draft.json.id,version:4});await review(draft.json.id,5);
  assert.ok((await request('',null,200,`/companies/${companyId}`)).text.includes(profile.name));
  assert.equal((await request('',null,200,`/api/company?view=company&id=${companyId}`)).json.company.published.name,profile.name);
  const update=await request(alice.cookie,{action:'draft',companyId,kind:'PROFILE',proposed:{...profile,description:'PRIVATE_PENDING_PROFILE_SHOULD_NOT_LEAK'}});
  await request(alice.cookie,{action:'submit',id:update.json.id,version:1});
  assert.ok(!(await request('',null,200,`/companies/${companyId}`)).text.includes('PRIVATE_PENDING_PROFILE_SHOULD_NOT_LEAK'));
  await review(update.json.id,2,'submission','REJECTED');
  const robot={name:'Isolated HTTP Robot',description:'A fixture model for a disposable database test only.',robotType:'service_robot',officialUrl:'https://portal-test.example.com/robot',sources:['https://portal-test.example.com/robot']};
  const robotDraft=await request(alice.cookie,{action:'draft',companyId,kind:'ROBOT',proposed:robot});
  assert.ok(!(await request('',null,200,'/robots')).text.includes(robot.name));
  await request(alice.cookie,{action:'submit',id:robotDraft.json.id,version:1});
  const reviews=await Promise.all([0,1].map(()=>request(admin.cookie,{action:'review',id:robotDraft.json.id,version:2,target:'submission',decision:'APPROVED',feedback:'Concurrent isolated review',verifiedRelationship:true},[200,409])));
  assert.deepEqual(reviews.map(r=>r.status).sort(),[200,409]);
  assert.equal((await testDb.query('SELECT count(*)::int AS n FROM "RobotModel"')).rows[0].n,1);
  const robotId=(await testDb.query('SELECT id FROM "RobotModel"')).rows[0].id;
  assert.ok((await request('',null,200,'/robots')).text.includes(robot.name));
  assert.ok((await request('',null,200,`/robots/${robotId}`)).text.includes(robot.name));
  await request(alice.cookie,{action:'save',id:robotDraft.json.id,version:3,proposed:robot},409);
  await request(alice.cookie,{action:'draft',companyId,kind:'RESEARCH',proposed:{title:'Invalid reference',authors:'Test',description:'Unsafe test URL is rejected.',sourceUrl:'javascript:alert(1)',documentType:'research_paper'}},422);
  await request(alice.cookie,{action:'draft',companyId,kind:'ROBOT',proposed:robot,role:'ADMIN'},422);
  const paper=await request(alice.cookie,{action:'draft',companyId,kind:'RESEARCH',proposed:{title:'Isolated HTTP technical document',authors:'Test Authors',description:'Technical reference fixture, no real paper is fabricated.',sourceUrl:'https://portal-test.example.com/manual',documentType:'technical_document'}});
  await request(alice.cookie,{action:'submit',id:paper.json.id,version:1});await review(paper.json.id,2);
  assert.ok((await request('',null,200,'/contributions')).text.includes('Isolated HTTP technical document'));
  assert.equal((await testDb.query('SELECT "relatedRobotModelId" FROM "Contribution"')).rows[0].relatedRobotModelId,null);
  await request(alice.cookie,{action:'logout'});await request(alice.cookie,null,401);
  for(const path of ['/company','/company-review','/companies','/profile','/submit-data','/match','/favorites','/database?table=submissions']) await request('',null,200,path);
  const blocked=await fetch(base+'/api/company',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example.com'},body:JSON.stringify({action:'logout'})});assert.equal(blocked.status,403);
  mkdirSync('output/company-portal',{recursive:true});writeFileSync('output/company-portal/http-test-results.json',JSON.stringify({isolatedDatabase:true,checks:results.length,results,concurrentRows:1,allPassed:true},null,2));
  console.log(`Company HTTP checks passed: ${results.length}; only disposable database ${name}.`);
  if(process.env.COMPANY_PORTAL_HOLD==='1') {console.log(`READY_BROWSER_TEST ${base} — send a newline on stdin to finish`);await new Promise(resolve=>{process.stdin.resume();process.stdin.once('data',resolve);process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});process.stdin.pause();}
} finally {
  if(child && child.exitCode===null){child.kill();await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,5000))]);}
  if(testDb) await testDb.end();
  if(created) {await root.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[name]);await root.query(`DROP DATABASE "${name}"`);console.log('Disposable HTTP test database removed.');}
  await root.end();
}
