import assert from "node:assert/strict";
import { test } from "node:test";
import { allowGeminiRequest, clientRateLimitKey } from "../lib/gemini-rate-limit";

test("limits Gemini requests per client window and resets after one minute", () => {
  const client = `unit-${crypto.randomUUID()}`;
  const start = 1_000_000;
  for (let count = 0; count < 5; count += 1) assert.equal(allowGeminiRequest(client, start + count), true);
  assert.equal(allowGeminiRequest(client, start + 10), false);
  assert.equal(allowGeminiRequest(client, start + 60_001), true);
});

test("uses the forwarding client address when available", () => {
  const request = new Request("http://localhost", { headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" } });
  assert.equal(clientRateLimitKey(request), "203.0.113.8");
});
