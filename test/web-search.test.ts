import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGoogleGroundedResponse, searchWithGoogleGrounding } from "../lib/ai/web-search";
import type { Evidence } from "../lib/research-assistant";

const evidence: Evidence[] = [{
  id: "robot-1", type: "robot", title: "Unitree G1", excerpt: "Registry description from HumanoidTH.",
  url: "https://example.org/robot", citation: 1, status: "Registry record"
}];

function groundedResponse(text: string) {
  return {
    candidates: [{
      content: { parts: [{ text }] },
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: "https://www.unitree.com/g1#specs", title: "Unitree G1" } },
          { web: { uri: "javascript:alert(1)", title: "Unsafe" } },
          { web: { uri: "https://www.unitree.com/g1#other", title: "Duplicate" } }
        ],
        groundingSupports: [{ segment: { endIndex: text.length }, groundingChunkIndices: [0, 1, 2] }],
        webSearchQueries: ["Unitree G1 official specifications", 42]
      }
    }]
  };
}

test("parses only safe, unique Google Search citations and links grounded claims", () => {
  const result = parseGoogleGroundedResponse(groundedResponse("Unitree publishes G1 specifications."), 4);
  assert.ok(result);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].citation, 5);
  assert.equal(result.sources[0].url, "https://www.unitree.com/g1");
  assert.match(result.answer, /\[5\]/);
  assert.deepEqual(result.searchQueries, ["Unitree G1 official specifications"]);
});

test("fails closed when Gemini returns no usable web citation", () => {
  assert.equal(parseGoogleGroundedResponse({
    candidates: [{ content: { parts: [{ text: "Unsupported claim." }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "file:///private", title: "Unsafe" } }] } }]
  }), null);
  assert.equal(parseGoogleGroundedResponse({ candidates: [{ content: { parts: [{ text: "No grounding metadata." }] } }] }), null);
});

test("uses Google Search grounding with only supplied HumanoidTH context", async () => {
  const priorKey = process.env.GEMINI_API_KEY;
  const priorModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-key-never-sent";
  process.env.GEMINI_MODEL = "test-model";
  let requestBody: unknown;
  const generate = async (body: unknown) => {
    requestBody = body;
    return new Response(JSON.stringify(groundedResponse("Official product page lists details.")), { status: 200 });
  };
  try {
    const result = await searchWithGoogleGrounding({ question: "Unitree G1 current price", role: "company", language: "en", evidence }, { generate });
    assert.ok(result);
    const body = requestBody as { tools?: unknown[]; systemInstruction?: { parts?: Array<{ text?: string }> }; contents?: Array<{ parts?: Array<{ text?: string }> }> };
    assert.deepEqual(body.tools, [{ google_search: {} }]);
    assert.match(body.systemInstruction?.parts?.[0]?.text || "", /untrusted data/);
    assert.match(body.contents?.[0]?.parts?.[0]?.text || "", /untrusted_humanoidth_evidence/);
    assert.doesNotMatch(JSON.stringify(body), /test-key-never-sent/);
  } finally {
    if (priorKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = priorKey;
    if (priorModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = priorModel;
  }
});

test("does not invoke the generator when Gemini is not configured", async () => {
  const priorKey = process.env.GEMINI_API_KEY;
  const priorModel = process.env.GEMINI_MODEL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  let called = false;
  try {
    const result = await searchWithGoogleGrounding({ question: "Unitree G1 price", role: "general", language: "en", evidence }, {
      generate: async () => { called = true; return new Response("{}", { status: 200 }); }
    });
    assert.equal(result, null);
    assert.equal(called, false);
  } finally {
    if (priorKey !== undefined) process.env.GEMINI_API_KEY = priorKey;
    if (priorModel !== undefined) process.env.GEMINI_MODEL = priorModel;
  }
});
