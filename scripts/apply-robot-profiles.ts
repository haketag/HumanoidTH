import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma';

const profiles = JSON.parse(readFileSync('data/robot-profiles.json', 'utf8')) as Array<{
  name: string;
  description: string | null;
  primaryUseCase: string | null;
  developerOrg: string | null;
  research?: Array<{ title: string; authors: string; url: string; description: string }>;
  sourceMeta: Record<string, unknown> & { imageUrl: string; imageSha256: string; sourceReview: { sourceUrl: string } };
}>;
assert.equal(new Set(profiles.map(p => p.name)).size, profiles.length);
for (const profile of profiles) {
  assert.match(profile.sourceMeta.imageUrl, /^\/images\/robots\/sourced\/[\w.-]+$/);
  const image = readFileSync(`public${profile.sourceMeta.imageUrl}`);
  assert.equal(createHash('sha256').update(image).digest('hex'), profile.sourceMeta.imageSha256);
}

try {
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "RobotModel" ORDER BY id FOR UPDATE`;
    const robots = await tx.robotModel.findMany();
    const names = new Set(robots.map(r => r.canonicalName));
    for (const profile of profiles) assert.ok(names.has(profile.name), `Unknown robot: ${profile.name}`);
    mkdirSync('output/robot-source-audit', { recursive: true });
    writeFileSync(`output/robot-source-audit/profiles-before-${Date.now()}.json`, JSON.stringify(robots, null, 2));
    for (const profile of profiles) {
      const robot = robots.find(r => r.canonicalName === profile.name)!;
      const previous = robot.sourceMeta as Record<string, unknown> | null;
      assert.ok(!previous?.companySubmission, `Company-published robot requires separate review: ${profile.name}`);
      await tx.robotModel.update({ where: { id: robot.id }, data: {
        description: profile.description,
        primaryUseCase: profile.primaryUseCase,
        developerOrg: profile.developerOrg,
        sourceMeta: JSON.parse(JSON.stringify({ ...previous, ...profile.sourceMeta }))
      } });
      for (const paper of profile.research || []) {
        const existing = await tx.contribution.findUnique({ where: { sourceUrl: paper.url } });
        if (existing) {
          assert.equal(existing.relatedRobotModelId, robot.id, 'Research URL belongs to another registry entry');
          continue;
        }
        await tx.contribution.create({ data: {
          title: paper.title, contributorName: paper.authors, contributorType: 'researchers',
          contributionType: 'research_paper', description: paper.description,
          sourceUrl: paper.url, relatedRobotModelId: robot.id,
          visibility: 'public', verificationStatus: 'NEEDS_REVIEW'
        } });
      }
    }
    return { updated: profiles.length, registryTotal: robots.length };
  }, { timeout: 20000 });
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
