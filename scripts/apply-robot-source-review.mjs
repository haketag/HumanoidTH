import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'output/robot-source-audit');
const read = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const before = read('output/robot-source-audit/robots-before.json');
const plan = read('data/robot-source-review.json');
const downloads = read('output/robot-source-audit/downloaded-images.json');
const approvedImages = new Set(['AI Police Cyborg 1.0', 'Bumi humanoid robot', 'Chula Rehabilitation Robots for Stroke Patients', 'CORGI Healthcare and Physical Therapy Assistant Robot', 'Dinsaw Robot', 'Khun Sean Smart Robot', 'NAO', 'Radioactive Iodine Therapy Medical Assistant Robot', 'Robo-Buddy']);
const captions = {
  'Bumi humanoid robot': 'Bumi product banner; does not verify the Bangkok exhibition claim.',
  'Chula Rehabilitation Robots for Stroke Patients': 'CUREs rehabilitation project photograph; not a single humanoid model.',
  'CORGI Healthcare and Physical Therapy Assistant Robot': 'Project launch: MELODY, HAPPY, LUCKY and CORGI; CORGI is the robot on the right.',
  'Dinsaw Robot': 'Dinsaw / Dinsow robot family across several generations.',
  'NAO': 'NAO6 product photograph; the hardware version of this registry entry is unspecified.',
  'Radioactive Iodine Therapy Medical Assistant Robot': 'Hospital project launch photograph with the medical assistant robot.',
};
assert.equal(plan.length, 17);
assert.equal(new Set(plan.map(p => p.name)).size, 17);
assert.equal(before.length, 17);
const checkedAt = new Date().toISOString();
const changes = plan.map(item => {
  const old = before.find(r => r.canonicalName === item.name);
  assert.ok(old, `Missing robot: ${item.name}`);
  const meta = { ...(old.sourceMeta || {}) };
  const partial = /partial|access_limited|secondary/.test(item.kind);
  meta.sourceReview = { checkedAt, sourceUrl: item.source, kind: item.kind, status: partial ? 'partial' : 'primary_source_checked', notes: item.notes, scope: 'Source attribution and reported functions only; not independent capability or clinical validation.' };
  let image = null;
  if (approvedImages.has(item.name)) {
    image = downloads.find(d => d.name === item.name && !d.error);
    assert.ok(image, `Missing approved image: ${item.name}`);
    assert.equal(image.image, item.image);
    assert.equal(createHash('sha256').update(readFileSync(image.file)).digest('hex'), image.sha256);
    meta.imageUrl = `/images/robots/sourced/${path.basename(image.file)}`;
    meta.imageOriginalUrl = image.image;
    meta.imageSourceUrl = item.source;
    meta.imageCredit = item.credit;
    meta.imageCaption = captions[item.name] || `${item.name} — original source photograph`;
    meta.imageSha256 = image.sha256;
    meta.imageRights = 'Original publisher retains rights; reuse permission has not been established.';
  } else {
    // No approved model photograph: do not retain an unverified legacy thumbnail.
    if (meta.imageUrl) meta.previousImageUrl = meta.imageUrl;
    delete meta.imageUrl;
  }
  if (item.useCase && old.primaryUseCase !== item.useCase) meta.importNotes = old.primaryUseCase;
  return { id: old.id, name: item.name, expectedUpdatedAt: old.updatedAt, primaryUseCase: item.useCase || old.primaryUseCase, description: item.description || old.description, developerOrg: item.developerOrg || old.developerOrg, sourceMeta: meta, image };
});
assert.equal(changes.filter(c => c.image).length, 9);
writeFileSync(path.join(out, 'proposed-changes.json'), JSON.stringify(changes, null, 2));
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ dryRun: true, robots: changes.length, images: 9 }));
} else {
  const receipt = path.join(out, 'applied-review.json');
  assert.ok(!existsSync(receipt), 'Review already applied; inspect the receipt before any further update.');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT id, "updatedAt" FROM "RobotModel" FOR UPDATE');
    assert.equal(current.rows.length, before.length, 'Robot count changed since backup');
    for (const change of changes) {
      const row = current.rows.find(r => r.id === change.id);
      assert.ok(row);
      assert.equal(new Date(row.updatedAt).toISOString(), change.expectedUpdatedAt, `Concurrent change: ${change.name}`);
    }
    mkdirSync(path.join(root, 'public/images/robots/sourced'), { recursive: true });
    for (const change of changes) {
      if (change.image) copyFileSync(change.image.file, path.join(root, 'public', change.sourceMeta.imageUrl));
      const result = await client.query('UPDATE "RobotModel" SET "primaryUseCase"=$1, description=$2, "developerOrg"=$3, "sourceMeta"=$4::jsonb, "updatedAt"=$5 WHERE id=$6', [change.primaryUseCase, change.description, change.developerOrg, JSON.stringify(change.sourceMeta), checkedAt, change.id]);
      assert.equal(result.rowCount, 1);
    }
    await client.query('COMMIT');
    writeFileSync(receipt, JSON.stringify({ checkedAt, robots: 17, images: 9, researchLinksAdded: 0, backup: 'robots-before.json', changes }, null, 2));
    console.log(JSON.stringify({ applied: true, robots: 17, images: 9, researchLinksAdded: 0 }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
}
