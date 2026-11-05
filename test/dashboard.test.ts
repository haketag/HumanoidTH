import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupRobotTypes, share } from '../lib/dashboard';
test('dashboard groups preserve every record, including unknown registry types', () => {
  const rows = [{ robotType: 'medical_assistant_robot', _count: { _all: 2 } }, { robotType: 'rehabilitation_robot', _count: { _all: 3 } }, { robotType: 'new_type', _count: { _all: 4 } }];
  for (const thai of [true, false]) {
    const grouped = groupRobotTypes(rows, thai);
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0].count, 5);
    assert.equal(grouped.reduce((sum, row) => sum + row.count, 0), 9);
  }
  assert.deepEqual(groupRobotTypes([], true), []);
  assert.equal(share(1, 0), 0);
  assert.equal(share(3, 4), 75);
  assert.equal(share(5, 4), 100);
});
