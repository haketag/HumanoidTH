import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getReviewedRobotImage, getRobotSourceImage, getRobotImageCredit } from '../lib/robot-images';

test('reviewed robots use only the selected image, never fuzzy article thumbnails', () => {
  const robot = { canonicalName: 'NAO', officialUrl: null, sourceMeta: { sourceReview: { status: 'partial' } } };
  const sources = [{ title: 'NAO article', url: 'https://example.org', platform: null, rawMeta: { image: 'wrong.jpg' } }];
  assert.equal(getRobotSourceImage(robot, sources), null);
  assert.equal(getRobotSourceImage({ ...robot, sourceMeta: { ...robot.sourceMeta, imageUrl: '/images/robots/nao.png' } }, sources), '/images/robots/nao.png');
  assert.equal(getRobotImageCredit({ imageSourceUrl: 'javascript:alert(1)' }), null);
  assert.equal(getRobotImageCredit({ imageSourceUrl: 'https://example.org', imageCredit: 'Publisher' })?.text, 'Publisher');
});

test('bundled robot photos keep their own source credit and require an exact model name', () => {
  const home = getReviewedRobotImage(' Dinsaw Mini Home AI Assistance ');
  const family = getReviewedRobotImage('Dinsaw Robot');
  assert.ok(home?.url && home.credit?.url);
  assert.ok(family?.url && family.credit?.url);
  assert.notEqual(home.url, family.url);
  assert.equal(getReviewedRobotImage('Dinsaw Mini 3 IPD'), null);
  assert.match(getReviewedRobotImage('Exoskeleton Wheelchair Robot')?.credit?.caption ?? '', /Figure 3/);
});
