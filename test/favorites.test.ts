import assert from 'node:assert/strict';
import { test } from 'node:test';
import {parseFavorites,toggleFavorite} from '../lib/favorites';
test('favorite toggles immediately without duplicates and roundtrips through storage',()=>{
  let ids = toggleFavorite([], 'robot-1');
  assert.deepEqual(ids,['robot-1']);
  assert.deepEqual(parseFavorites(JSON.stringify(ids)), ids);
  assert.deepEqual(parseFavorites('["robot-1","robot-1"]'),ids);
  ids=toggleFavorite(ids,'robot-1');
  assert.deepEqual(ids,[]);
});
test('invalid storage is rejected, missing storage is empty, unknown syntactically valid IDs are safe references',()=>{
  assert.deepEqual(parseFavorites(null),[]);
  for(const raw of ['{','{}','[1]','[null]','["../../admin"]',JSON.stringify(Array(201).fill('a'))]) assert.throws(()=>parseFavorites(raw));
  assert.deepEqual(parseFavorites('["deleted-robot"]'),['deleted-robot']);
});
