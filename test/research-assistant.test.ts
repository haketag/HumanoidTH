import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOpenAlexPublicationDate, reconstructOpenAlexAbstract } from "../lib/ingest/adapters";
import { excerptAnswer, safeSourceUrl, searchTerms } from "../lib/research-assistant";
import { createPlanOwnerToken, hashPlanOwnerToken, isValidPlanOwnerToken, planInputSchema, validatePlanOrigin } from "../lib/living-lab-plans";

test("reconstructs an OpenAlex abstract in token order", () => {
  assert.equal(reconstructOpenAlexAbstract({
    "humanoid": [2],
    "A": [0],
    "robot": [3],
    "social": [1]
  }), "A social humanoid robot");
});

test("ignores malformed OpenAlex abstract indexes", () => {
  assert.equal(reconstructOpenAlexAbstract(null), "");
  assert.equal(reconstructOpenAlexAbstract({ misplaced: ["1", -1, 100_000], empty: "bad" }), "");
});

test("keeps only valid full-precision OpenAlex publication dates", () => {
  assert.equal(parseOpenAlexPublicationDate("2025-08-12")?.toISOString(), "2025-08-12T00:00:00.000Z");
  assert.equal(parseOpenAlexPublicationDate("2025-02-31"), null);
  assert.equal(parseOpenAlexPublicationDate("2025"), null);
});

test("deduplicates query terms and ignores common Thai stop words", () => {
  assert.deepEqual(searchTerms("หุ่นยนต์ NAO และ NAO"), ["หุ่นยนต์", "nao"]);
});

test("only exposes web URLs as source links", () => {
  assert.equal(safeSourceUrl("https://example.org/paper"), "https://example.org/paper");
  assert.equal(safeSourceUrl("javascript:alert(1)"), null);
  assert.equal(safeSourceUrl("data:text/html,unsafe"), null);
});

test("does not infer that research is absent when retrieval returns no records", () => {
  const result = excerptAnswer([], "NAO older adults", "researcher", "en");
  assert.equal(result.mode, "no_results");
  assert.match(result.answer, /does not establish/i);
  assert.equal(result.evidence.length, 0);
});

test("keeps role guidance separate from authorization", () => {
  const evidence = [{ id: "robot-1", type: "robot" as const, title: "NAO", excerpt: "A registry record", url: null, citation: 1, status: "Registry record" }];
  const company = excerptAnswer(evidence, "NAO", "company", "en");
  assert.match(company.answer, /robot models/);
  assert.doesNotMatch(company.answer, /รุ่นหุ่นยนต์/);
  assert.match(company.answer, /capability\/manufacturer/);
  assert.match(company.limitations.join(" "), /not independent/);
  const thai = excerptAnswer(evidence, "NAO", "company", "th");
  assert.match(thai.answer, /รุ่นหุ่นยนต์/);
});

test("validates plan evidence and bounded Living Lab context", () => {
  const base = { title: "Plan", question: "NAO activity", evidence: [{ id: "robot-1", type: "robot" }] };
  assert.equal(planInputSchema.safeParse(base).success, true);
  assert.equal(planInputSchema.safeParse({ ...base, evidence: [] }).success, false);
  assert.equal(planInputSchema.safeParse({ ...base, role: "admin" }).success, false);
  assert.equal(planInputSchema.safeParse({ ...base, title: "x".repeat(121) }).success, false);
});

test("uses an opaque, high-entropy owner token and stores only a stable hash", () => {
  const first = createPlanOwnerToken();
  const second = createPlanOwnerToken();
  assert.notEqual(first, second);
  assert.equal(first.length, 64);
  assert.equal(isValidPlanOwnerToken(first), true);
  assert.equal(isValidPlanOwnerToken("guessable"), false);
  assert.notEqual(hashPlanOwnerToken(first), first);
  assert.equal(hashPlanOwnerToken(first), hashPlanOwnerToken(first));
});

test("rejects cross-origin Living Lab plan mutations", () => {
  assert.equal(validatePlanOrigin(new Request("http://localhost/api/living-lab-plans", { headers: { origin: "http://attacker.invalid" } })), false);
  assert.equal(validatePlanOrigin(new Request("http://localhost/api/living-lab-plans", { headers: { origin: "http://localhost" } })), true);
});
