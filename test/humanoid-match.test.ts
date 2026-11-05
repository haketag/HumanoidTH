import assert from 'node:assert/strict';
import { test } from 'node:test';
import { industries, tasks, selection, matchRobot, safeUrl } from '../lib/humanoid-match';
test('taxonomy has twelve tasks and rejects cross-industry and invalid selections', () => {
  assert.equal(industries.length, 4);
  assert.equal(Object.keys(tasks).length, 12);
  for (const industry of industries) for (const task of industry.tasks) assert.ok(selection(industry.id, task).task?.requirements.length);
  assert.equal(selection('healthcare','delivery').task, undefined);
  assert.equal(selection('invalid','greeting').industry, undefined);
  assert.equal(selection('healthcare','toString').task, undefined);
});
test('descriptions, names, and missing evidence never produce verified matches', () => {
  for (const robot of [null, {}, {canonicalName:'Speech Navigation Robot',description:'verified speech'}]) {
    const result = matchRobot(robot, tasks.guidance.requirements);
    assert.equal(result.supported,false);
    assert.ok(result.requirements.every(r=>r.status==='Not verified'));
  }
});
test('only usable web citations are linked', () => {
  for (const url of ['javascript:alert(1)','seed:paper','',null]) assert.equal(safeUrl(url),null);
  assert.equal(safeUrl('https://doi.org/10.123/example'),'https://doi.org/10.123/example');
});
test('custom tasks require a valid industry and bounded nonempty text, without inferred capabilities', () => {
  assert.equal(selection('healthcare','other','  ช่วยจัดยา  ').task?.name,'ช่วยจัดยา');
  assert.deepEqual(selection('healthcare','other','ช่วยจัดยา').task?.requirements,[]);
  for (const value of ['', '   ', 'a'.repeat(301)]) assert.equal(selection('healthcare','other',value).task,undefined);
  assert.equal(selection('invalid','other','task').task,undefined);
});
