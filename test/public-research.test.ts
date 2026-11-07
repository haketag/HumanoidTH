import assert from "node:assert/strict";
import { test } from "node:test";
import { searchPublicResearch, sourcePassages, validateResearchClaims, type ResearchRecord } from "../lib/ai/public-research";
import { ResearchError, researchErrorResponse } from "../lib/ai/research-errors";
import type { SearchInput } from "../lib/ai/web-search";

const excerpt = "NAO is a programmable humanoid robot used in education and research.";
const input: SearchInput = { question: "NAO คืออะไร", expertRole: "robotics_engineer", role: "company", language: "th", evidence: [], citationOffset: 4 };
const ai = (value: unknown) => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 });
const fixtureFetch: typeof fetch = async (url) => {
  const host = new URL(String(url)).hostname;
  assert.ok(["en.wikipedia.org", "api.crossref.org"].includes(host));
  return new Response(JSON.stringify(host === "en.wikipedia.org" ? { query: { pages: { "1": { title: "NAO", fullurl: "https://en.wikipedia.org/wiki/NAO_(robot)", extract: excerpt } } } } : { message: { items: [{ DOI: "10.1234/nao", title: ["A NAO study"], publisher: "Research publisher" }] } }));
};
const valid = { claims: [{ kind: "factual", text: "NAO เป็นหุ่นยนต์ฮิวแมนนอยด์ที่เขียนโปรแกรมได้", citations: [5], support: [{ citation: 5, quote: excerpt }] }] };
const record: ResearchRecord = { citation: 5, title: "NAO", url: "https://en.wikipedia.org/wiki/NAO_(robot)", excerpt, contentLevel: "intro" };
const errorCode = (code: string) => (error: unknown) => error instanceof ResearchError && error.code === code;

test("public research retrieves external sources, synthesizes a cited answer, and reports scope", async () => {
  let calls = 0;
  const result = await searchPublicResearch(input, { fetch: fixtureFetch, generate: async (body) => {
    calls++;
    const text = JSON.stringify(body);
    assert.doesNotMatch(text, /GEMINI_API_KEY/);
    if (calls === 1) return ai({ query: "NAO robot" });
    assert.match(text, /robotics engineering specialist/);
    assert.match(text, /untrusted_sources/);
    return ai(valid);
  } });
  assert.match(result.answer, /\[5\]/);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].contentLevel, "intro");
  assert.equal(result.provider, "public");
  assert.equal(result.evidenceChecks?.quotesMatched, true);
  assert.equal(result.evidenceChecks?.independentlyVerified, false);
  assert.equal(result.citationEvidence?.[0].quote, excerpt);
});

test("an incomplete query rewrite does not block actual source retrieval", async () => {
  let calls = 0;
  const result = await searchPublicResearch(input, { fetch: fixtureFetch, generate: async () => ++calls === 1 ? new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] })) : ai(valid) });
  assert.ok(result.sources.length);
  assert.match(result.searchQueries[0], /NAO/);
});

test("authentication and quota failures remain distinct, with no unnecessary search requests", async () => {
  for (const [status, code] of [[401, "AI_AUTH"], [403, "AI_AUTH"], [429, "AI_QUOTA"], [404, "AI_MODEL"], [400, "AI_CONFIGURATION"]] as const) {
    let fetches = 0;
    await assert.rejects(searchPublicResearch(input, { generate: async () => new Response("{}", { status }), fetch: async () => { fetches++; return new Response("{}"); } }), errorCode(code));
    assert.equal(fetches, 0);
  }
});

test("provider outage differs from an empty search result", async () => {
  await assert.rejects(searchPublicResearch(input, { generate: async () => ai({ query: "NAO robot" }), fetch: async () => new Response("{}", { status: 503 }) }), errorCode("SOURCE_UNAVAILABLE"));
  await assert.rejects(searchPublicResearch(input, { generate: async () => ai({ query: "NAO robot" }), fetch: async () => new Response("{}") }), errorCode("NO_SOURCES"));
});

test("source downloads enforce a size bound", async () => {
  await assert.rejects(searchPublicResearch(input, { generate: async () => ai({ query: "NAO robot" }), fetch: async () => new Response("{}", { headers: { "content-length": "9999999" } }) }), errorCode("SOURCE_UNAVAILABLE"));
});

test("invented citation IDs and invented supporting quotes are rejected", () => {
  assert.throws(() => validateResearchClaims({ claims: [{ ...valid.claims[0], citations: [99] }] }, [record]), errorCode("UNSUPPORTED_CLAIM"));
  assert.throws(() => validateResearchClaims({ claims: [{ ...valid.claims[0], support: [{ citation: 5, quote: "This invented sentence was not in the retrieved source." }] }] }, [record]), errorCode("UNSUPPORTED_CLAIM"));
});

test("bibliographic metadata cannot support substantive factual claims", () => {
  assert.throws(() => validateResearchClaims(valid, [{ ...record, contentLevel: "metadata" }]), errorCode("UNSUPPORTED_CLAIM"));
  assert.doesNotThrow(() => validateResearchClaims({ claims: [{ ...valid.claims[0], kind: "bibliographic" }] }, [{ ...record, contentLevel: "metadata" }]));
});

test("unsupported answer gets one bounded correction attempt and then fails visibly", async () => {
  let calls = 0;
  const unsupported = { claims: [{ ...valid.claims[0], citations: [88] }] };
  await assert.rejects(searchPublicResearch(input, { fetch: fixtureFetch, generate: async () => ++calls === 1 ? ai({ query: "NAO robot" }) : ai(unsupported) }), errorCode("UNSUPPORTED_CLAIM"));
  assert.equal(calls, 3);
});

test("a corrected answer can succeed without returning unverified claims", async () => {
  let calls = 0;
  const result = await searchPublicResearch(input, { fetch: fixtureFetch, generate: async () => { calls++; if (calls === 1) return ai({ query: "NAO robot" }); return calls === 2 ? new Response("not-json") : ai(valid); } });
  assert.equal(calls, 3);
  assert.match(result.answer, /\[5\]/);
});

test("safe user errors do not expose provider text, URLs, or credentials", () => {
  const result = researchErrorResponse(new ResearchError("AI_QUOTA", "answer", 429), "th");
  assert.equal(result.status, 429);
  assert.match(result.error, /โควตา/);
  assert.doesNotMatch(result.error, /API_KEY|AQ\.|AIza/);
});

test("server passage IDs preserve exact provenance and reject invented passages", () => {
  const passage = sourcePassages(record)[0];
  const claim = { ...valid.claims[0], support: [{ citation: 5, passageId: passage.id }] };
  const checked = validateResearchClaims({ claims: [claim] }, [record]);
  assert.equal(checked.support[0].quote, passage.quote);
  assert.throws(() => validateResearchClaims({ claims: [{ ...claim, support: [{ citation: 5, passageId: "5_p999" }] }] }, [record]), errorCode("UNSUPPORTED_CLAIM"));
});

test("correction requests keep selectable source passages available", async () => {
  let calls = 0;
  await searchPublicResearch(input, { fetch: fixtureFetch, generate: async (body) => {
    calls++;
    if (calls === 1) return ai({ query: "NAO robot" });
    if (calls === 2) return new Response("broken JSON");
    const request = body as { contents: Array<{ parts: Array<{ text: string }> }> };
    const context = JSON.parse(request.contents[0].parts[0].text);
    assert.ok(context.untrusted_sources[0].passages[0].id);
    return ai({ claims: [{ ...valid.claims[0], support: [{ citation: 5, passageId: context.untrusted_sources[0].passages[0].id }] }] });
  } });
  assert.equal(calls, 3);
});
