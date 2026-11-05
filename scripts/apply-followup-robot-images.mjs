import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const out = path.resolve('output/robot-source-audit/followup');
const downloads = JSON.parse(readFileSync(path.join(out, 'downloads.json'), 'utf8'));
const pdf = 'https://www.dop.go.th/download/statistics/th1635826412-975_0.pdf#page=109';
const paper = 'https://www.mdpi.com/2218-6581/12/1/16';
const selected = [
  { name: 'Dinsaw Mini Home AI Assistance', candidate: 'Dinsaw Mini Home AI Assistance', credit: 'CT Asia Robotics / Dinsaw', caption: 'Dinsaw Mini Home AI — manufacturer product artwork.', notes: 'Manufacturer product page and labelled product image found. Home AI is distinguished from IPD and Pro4. Manufacturer care claims are not clinical validation.' },
  { name: 'Exoskeleton Wheelchair Robot', candidate: 'Exoskeleton paper figure 3', credit: 'Ronnapee Chaichaowarat, Sarunpat Prakthong and Siri Thitipankul / Robotics 2023, 12(1), 16, Figure 3', caption: '2023 alpha prototype in standing and wheelchair configurations — Figure 3, DOI: 10.3390/robotics12010016. Unmodified image.', notes: 'Original 2023 journal paper and 2025 ISE university project page checked. Image depicts the 2023 alpha prototype, not a certified clinical product or an assumed later hardware revision.', rights: 'CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/; original image unchanged.' },
  { name: 'SR1 Security Robot', candidate: 'SR1 Security Robot', credit: 'MQDC / Obodroid', caption: 'SR1 handover at Whizdom Station Ratchada-Thapra, reported by project operator MQDC in March 2022.', notes: 'Operator MQDC explicitly identifies SR1 and publishes the handover photograph. Original Obodroid image download remains unavailable; this is a project-operator source, not independent performance validation.' },
  { name: 'Pinto Robot', file: 'page-109-0-Im0.jpg', source: pdf, credit: 'Chulalongkorn University image reproduced in Situation of the Thai Older Persons 2020 / Department of Older Persons, printed p.107', caption: 'Pinto — image embedded in the official report, section 4.7.2 (PDF page 109).', notes: 'Official government report explicitly labels Pinto in section 4.7.2. The adjacent embedded image was verified by its PDF placement. This is an official report reproducing a university image, not a journal research paper.' },
  { name: 'Mirror Telepresence System', file: 'page-109-3-Im3.jpg', source: pdf, credit: 'Chulalongkorn University image reproduced in Situation of the Thai Older Persons 2020 / Department of Older Persons, printed p.107', caption: 'Mirror — image embedded in the official report, section 4.7.3 (PDF page 109).', notes: 'Official government report explicitly labels Mirror in section 4.7.3. The adjacent embedded image was verified by its PDF placement. This is an official report reproducing a university image, not a journal research paper.' },
].map(item => {
  const downloaded = item.candidate ? downloads.find(d => d.name === item.candidate && !d.error) : null;
  if (item.candidate) assert.ok(downloaded, `Missing candidate: ${item.candidate}`);
  const file = downloaded?.file || path.join(out, item.file);
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (downloaded) assert.equal(sha256, downloaded.sha256);
  return { ...item, file, sha256, source: downloaded?.source || item.source, original: downloaded?.image || item.source, url: `/images/robots/sourced/followup-${path.basename(file)}` };
});
assert.equal(new Set(selected.map(i => i.name)).size, 5);
writeFileSync(path.join(out, 'selected-images.json'), JSON.stringify(selected, null, 2));
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ dryRun: true, images: selected.length, researchPapers: 1 }));
} else {
  const receipt = path.join(out, 'applied.json');
  assert.ok(!existsSync(receipt), 'Follow-up already applied');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM "RobotModel" WHERE "canonicalName"=ANY($1::text[]) FOR UPDATE', [selected.map(i => i.name)]);
    assert.equal(result.rowCount, 5);
    assert.ok(!existsSync(path.join(out, 'robots-before-followup.json')), 'Preserve existing follow-up backup');
    writeFileSync(path.join(out, 'robots-before-followup.json'), JSON.stringify(result.rows, null, 2));
    const checkedAt = new Date().toISOString();
    for (const item of selected) {
      const row = result.rows.find(r => r.canonicalName === item.name);
      assert.ok(!row.sourceMeta?.imageUrl, `Robot already has an image: ${item.name}`);
      copyFileSync(item.file, path.join(process.cwd(), 'public', item.url));
      const meta = { ...row.sourceMeta, previousSourceReview: row.sourceMeta?.sourceReview, imageUrl: item.url, imageOriginalUrl: item.original, imageSourceUrl: item.source, imageCredit: item.credit, imageCaption: item.caption, imageSha256: item.sha256, imageRights: item.rights || 'Original publisher retains rights; reuse permission not established.', sourceReview: { checkedAt, sourceUrl: item.source, status: item.file.includes('page-109') ? 'official_report_checked' : 'primary_source_checked', notes: item.notes, scope: 'Image identity and source checked; does not establish independent capability or clinical validation.' } };
      const updated = await client.query('UPDATE "RobotModel" SET "sourceMeta"=$1::jsonb,"updatedAt"=$2 WHERE id=$3', [JSON.stringify(meta), checkedAt, row.id]);
      assert.equal(updated.rowCount, 1);
    }
    const exo = result.rows.find(r => r.canonicalName === 'Exoskeleton Wheelchair Robot');
    const inserted = await client.query('INSERT INTO "Contribution" (id,"contributorName","contributorType",organization,"contributionType",title,description,"relatedRobotModelId","sourceUrl",license,visibility,"verificationStatus","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) ON CONFLICT ("sourceUrl") DO NOTHING', [randomUUID(), 'Ronnapee Chaichaowarat; Sarunpat Prakthong; Siri Thitipankul', 'researchers', 'International School of Engineering, Chulalongkorn University', 'research_paper', 'Transformable Wheelchair–Exoskeleton Hybrid Robot for Assisting Human Locomotion', 'Robotics 2023, 12(1), 16. DOI: 10.3390/robotics12010016. Original paper checked; Figure 3 shows the 2023 alpha prototype. Linked at project-family level; does not establish equivalence to later revisions, clinical certification or task suitability.', exo.id, paper, 'CC BY 4.0', 'public', 'NEEDS_REVIEW', checkedAt]);
    await client.query('COMMIT');
    writeFileSync(receipt, JSON.stringify({ checkedAt, imagesAdded: 5, researchPapersAdded: inserted.rowCount, selected }, null, 2));
    console.log(JSON.stringify({ imagesAdded: 5, researchPapersAdded: inserted.rowCount }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
}
