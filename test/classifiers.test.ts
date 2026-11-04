import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyRelevance, extractPerspective } from "../lib/classifiers";

test("classifies Thailand robot records as accepted", () => {
  assert.equal(classifyRelevance("Dinsaw robot in Thailand hospital").relevanceStatus, "ACCEPTED");
});

test("rejects unrelated records", () => {
  assert.equal(classifyRelevance("Generic cloud chatbot launch").relevanceStatus, "REJECTED");
});

test("abstains on thin perspective evidence", () => {
  assert.equal(extractPerspective("", "").method, "abstain_thin_evidence");
});

test("does not classify Android phones as robots", () => {
  assert.equal(classifyRelevance("Android smartphone sales in Thailand").relevanceStatus, "REJECTED");
});

test("does not match the NAO alias inside an unrelated name", () => {
  assert.equal(classifyRelevance("Naomi Osaka wins a tennis match in Thailand").relevanceStatus, "REJECTED");
});

test("does not treat eldercare funding as robotics evidence", () => {
  assert.equal(classifyRelevance("Eldercare funding in Thailand").relevanceStatus, "REJECTED");
});

test("recognizes NAO with a Thai university context", () => {
  assert.equal(classifyRelevance("NAO trial at a Thai university").relevanceStatus, "ACCEPTED");
});

test("handles negated Thai claims without flipping them to supportive", () => {
  const result = extractPerspective("หุ่นยนต์ไทยไม่ได้ช่วยลดความเหงา", "ผลการศึกษายังไม่ยืนยันว่าหุ่นช่วยได้");
  assert.equal(result.stance, "skeptical");
  assert.equal(result.sentiment, "negative");
});
