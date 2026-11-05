import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';

const file='prisma/migrations/20261102000100_company_portal/migration.sql';
const sql=readFileSync(file,'utf8');
assert.ok(!/(?:^|;)\s*(DROP|TRUNCATE|DELETE|UPDATE|ALTER)\b/i.test(sql),'Additive migration only');
try {
  const tables=await prisma.$queryRaw<{installed:string|null}[]>`SELECT to_regclass('"Company"')::text AS installed`;
  if(tables[0].installed) throw new Error('Company schema already exists; refusing repeat application.');
  const before=await prisma.$queryRaw<{robots:bigint;sources:bigint;contributions:bigint;users:bigint}[]>`SELECT (SELECT count(*) FROM "RobotModel") AS robots,(SELECT count(*) FROM "SourceRecord") AS sources,(SELECT count(*) FROM "Contribution") AS contributions,(SELECT count(*) FROM "User") AS users`;
  console.log(JSON.stringify({dryRun:!process.argv.includes('--apply'),migration:file,counts:before},(_,v)=>typeof v==='bigint' ? Number(v) : v));
  if(process.argv.includes('--apply')) {
    mkdirSync('output/company-portal',{recursive:true});
    const snapshot=await prisma.$queryRaw`SELECT * FROM "RobotModel" ORDER BY id`;
    writeFileSync(`output/company-portal/pre-migration-${Date.now()}.json`,JSON.stringify({before,robots:snapshot},(_,v)=>typeof v==='bigint'?Number(v):v,2));
    await prisma.$transaction(async tx=>{
      for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      const after=await tx.$queryRaw`SELECT (SELECT count(*) FROM "RobotModel") AS robots,(SELECT count(*) FROM "SourceRecord") AS sources,(SELECT count(*) FROM "Contribution") AS contributions,(SELECT count(*) FROM "User") AS users`;
      assert.deepEqual(after,before);
    },{timeout:30000});
    writeFileSync('output/company-portal/migration-receipt.json',JSON.stringify({appliedAt:new Date().toISOString(),file,sha256:createHash('sha256').update(sql).digest('hex')},null,2));
    console.log('Additive migration applied; existing row counts unchanged. Live DB was created through db:push and has no Prisma migration history; no baseline/reset was attempted.');
  }
} finally {await prisma.$disconnect();}
