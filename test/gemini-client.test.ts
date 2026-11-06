import assert from "node:assert/strict";
import { test } from "node:test";
import { createGeminiTransport } from "../lib/gemini-client";

const input = { apiKey: "test-only-key", model: "test-model", body: { contents: [{ parts: [{ text: "hello" }] }] } };
const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }));

test("recovers from 503 and 429 with backoff and respects Retry-After", async () => {
  let clock = 1_000;
  let calls = 0;
  const delays: number[] = [];
  const request = createGeminiTransport({
    now: () => clock,
    random: () => 0,
    sleep: async ms => { delays.push(ms); clock += ms; },
    fetch: async () => {
      calls++;
      if (calls === 1) return new Response("busy", { status: 503 });
      if (calls === 2) return new Response("limited", { status: 429, headers: { "Retry-After": "7" } });
      return ok();
    }
  });
  assert.equal((await request(input)).status, 200);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [2000, 7000]);
});

test("does not retry or cache invalid credentials", async () => {
  let calls = 0;
  const request = createGeminiTransport({ fetch: async () => { calls++; return new Response(input.apiKey, { status: 401 }); } });
  const result = await request(input);
  assert.equal(result.status, 401);
  assert.equal(await result.text(), "[REDACTED]");
  await request(input);
  assert.equal(calls, 2);
});

test("coalesces simultaneous identical requests and caches successful results only briefly", async () => {
  let calls = 0;
  let clock = 1000;
  const request = createGeminiTransport({ now: () => clock, fetch: async () => { calls++; return ok(); } });
  const results = await Promise.all([request(input), request(input), request(input)]);
  assert.equal(calls, 1);
  assert.deepEqual(await Promise.all(results.map(r => r.json())), Array(3).fill({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }));
  await request(input);
  assert.equal(calls, 1);
  clock += 60_001;
  await request(input);
  assert.equal(calls, 2);
  await request({ ...input, apiKey: "another-test-key" });
  assert.equal(calls, 3);
});

test("serializes distinct requests across one transport", async () => {
  let active = 0;
  let maximum = 0;
  const request = createGeminiTransport({ fetch: async () => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return ok();
  } });
  await Promise.all([1, 2, 3].map(number => request({ ...input, body: { number } })));
  assert.equal(maximum, 1);
});

test("stops at the retry limit and does not cache overloaded responses", async () => {
  let calls = 0;
  let clock = 1000;
  const request = createGeminiTransport({ now: () => clock, random: () => 0, sleep: async ms => { clock += ms; }, fetch: async () => { calls++; return new Response("busy", { status: 503 }); } });
  assert.equal((await request(input)).status, 503);
  assert.equal(calls, 4);
  assert.equal((await request(input)).status, 503);
  assert.equal(calls, 8);
});

test("does not retry before a long upstream Retry-After or exceed the request budget", async () => {
  let calls = 0;
  const request = createGeminiTransport({ random: () => 0, fetch: async () => {
    calls++;
    return new Response("limited", { status: 429, headers: { "Retry-After": "120" } });
  } });
  assert.equal((await request({ ...input, timeoutMs: 1000 })).status, 429);
  assert.equal(calls, 1);
});

test("network errors are retried but queue wait has a deadline", async () => {
  let calls = 0;
  let clock = 1000;
  const request = createGeminiTransport({ now: () => clock, random: () => 0, sleep: async ms => { clock += ms; }, fetch: async () => {
    if (++calls === 1) throw new TypeError("network unavailable");
    return ok();
  } });
  assert.equal((await request(input)).status, 200);
  assert.equal(calls, 2);

  let finish!: () => void;
  const queued = createGeminiTransport({ fetch: async () => { await new Promise<void>(resolve => { finish = resolve; }); return ok(); } });
  const running = queued(input);
  await assert.rejects(queued({ ...input, body: { other: true }, timeoutMs: 10 }), /expired while waiting/);
  finish();
  await running;
});
