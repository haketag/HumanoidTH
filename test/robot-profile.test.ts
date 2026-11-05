import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { robotProfile } from '../lib/robot-profile';

test('robot links prefer reviewed references, reject unsafe URLs and support older metadata', () => {
  assert.equal(robotProfile(null, 'https://example.org/robot').sourceUrl, 'https://example.org/robot');
  const profile = robotProfile({ sourceReview: { sourceUrl: 'https://example.org/paper' }, contact: { url: 'javascript:alert(1)', name: 'Developer' } }, 'https://example.org/old');
  assert.equal(profile.sourceUrl, 'https://example.org/paper');
  assert.equal(profile.contactUrl, null);
  assert.equal(robotProfile({}, 'seed:placeholder').sourceUrl, null);
});

test('every enriched registry entry has an existing credited image, source and contact', () => {
  const profiles = JSON.parse(readFileSync('data/robot-profiles.json', 'utf8'));
  assert.equal(profiles.length, 17);
  assert.equal(new Set(profiles.map((p: { name: string }) => p.name)).size, 17);
  for (const item of profiles) {
    const meta = item.sourceMeta;
    const profile = robotProfile(meta, null);
    assert.ok(profile.sourceUrl, item.name);
    assert.ok(profile.contactUrl, item.name);
    assert.ok(profile.descriptionTh, item.name);
    assert.ok(meta.imageCredit && meta.imageSourceUrl, item.name);
    assert.equal(createHash('sha256').update(readFileSync(`public${meta.imageUrl}`)).digest('hex'), meta.imageSha256, item.name);
  }
});
