import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminSessionToken, verifyAdminSessionToken } from '../lib/admin-session';

test('admin sessions require a valid signature, configured secret and unexpired token', async () => {
  const secret = 'isolated-admin-session-test-secret-12345';
  const now = 1_800_000_000_000;
  const token = await createAdminSessionToken(secret, now);
  assert.ok(token);
  assert.equal(await verifyAdminSessionToken(token, secret, now), true);
  assert.equal(await verifyAdminSessionToken('true', secret, now), false);
  assert.equal(await verifyAdminSessionToken(token, secret + '-wrong', now), false);
  assert.equal(await verifyAdminSessionToken(token, secret, now + 8 * 60 * 60 * 1000), false);
  assert.equal(await createAdminSessionToken(undefined, now), null);
});
