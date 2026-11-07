# Pet AI Research Assistant Audit

Audit date: 2026-11-07

## Existing implementation

- The application is a Next.js App Router project using Prisma and PostgreSQL. `lib/prisma.ts` creates the Prisma client lazily and uses the existing PostgreSQL adapter.
- The Research Assistant UI is in `app/research-assistant/ResearchAssistantClient.tsx`; requests go to `app/api/research-assistant/route.ts`.
- Internal retrieval searches accepted `SourceRecord` title/excerpt, public approved `Contribution`, `RobotModel`, relevant `PerspectiveAnnotation`, and public `OwnedInventory` records. A selected robot ID loads its registry record directly.
- Evidence is ranked and shown with citations. `SourceRecord` URLs and robot/contribution URLs are clickable. Gemini synthesis is optional, server-side, rate-limited, and requires explicit adult consent.
- OpenAlex ingestion reconstructs abstracts, but persists only a 1,200-character excerpt and metadata. `SourceRecord` has no full-text/document storage or chunk index. The UI does not fetch or extract source pages/PDFs.
- A modular Google Search grounding client and parser already exist in `lib/ai/web-search.ts`, with unit tests in `test/web-search.test.ts`. At audit time the route has a separate grounding implementation; this should be consolidated onto the tested module. Google Search citations can be parsed from grounding metadata.
- The assistant currently handles one question per request. It has robot context when entered from a robot record, but no chat transcript or follow-up history is sent to the API.
- The schema includes minimal helpful/unhelpful feedback (`ResearchAssistantFeedback`) but not issue categories or comments.
- Existing tests include Research Assistant helpers, Gemini transport, rate limiting, and web-grounding parsing. They do not exercise the full Research Assistant API against controlled Prisma fixtures or perform live web/PDF retrieval.

## Gaps against the requested experience

1. The API does not search `Company`/organization records directly, retrieve more than source abstracts, or follow/inspect record links.
2. PDF/page text extraction, relevant document chunk selection, and page/section citations are not implemented. No PDF extraction package is present in the declared dependencies.
3. User-provided URLs/images are not modeled as separate inputs. There is no image/OCR capability in this flow.
4. The low-confidence web fallback was just connected in the preceding change, but currently duplicates the existing tested Google grounding module and does not yet include a fully verified end-to-end run.
5. No conversation history is carried across requests; follow-up questions may lose the earlier robot or paper context.
6. Confidence evaluation is a heuristic over keyword coverage and source presence. It does not detect conflicting source claims, content recency, or whether a paper's full text was actually read.
7. Existing feedback is limited to a vote and minimal context.

## Configuration and verification limits

- The code expects server-side `DATABASE_URL`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. This audit does not record secret values and does not establish that external services are reachable.
- The database schema already contains the records needed for first-stage retrieval; persistent full-text storage would require a schema/migration decision and is not necessary to try bounded URL-context reading of public source links.
- Full-text retrieval must remain bounded to a small number of relevant, public URLs. Paywalled, unsupported, unavailable, or unsafe sources must be reported as unread rather than treated as evidence.

## Work completed after the audit snapshot

- The route now uses the existing tested Google Search grounding module rather than a duplicate implementation.
- For partial/low-confidence and current-information queries, with consent, the server can send up to eight sanitized URLs from the question and selected records to Gemini URL Context. Public PDF, HTML, and other supported URLs can be read by the provider. URL retrieval status and grounded search citations are returned; no document text is persisted.
- OpenAlex ingestion now retains the public PDF/landing-page URL fields for future retrieval. Existing source records need a subsequent ingestion update to receive these fields.
- Company directory records are now included in internal retrieval.
- Follow-up retrieval combines recent user questions and selected robot context. The prompt receives bounded recent conversation as untrusted context; history remains in page memory and is not stored server-side.
- Added answer feedback controls and a same-origin validated feedback endpoint. The additive migration for issue category/comment fields was applied to the connected Supabase project and the columns were verified.
- A live request returned HTTP 200 from the internal retrieval flow. Live web fallback was attempted but Gemini returned HTTP 401, so grounded web citations/PDF reads are not yet verified. The configured key must be replaced with a valid Gemini API key.
- The connected database currently has no `Company` table. The route checks for it without failing the whole request and reports that organization records could not be checked.
- Prisma uses its client engine with the existing PostgreSQL driver adapter, avoiding a locked Rust query-engine DLL during regeneration.

## Remaining limitations

- URL Context delegates extraction to Gemini; the application does not download papers, persist text chunks, perform local PDF parsing/OCR, or provide page-level citations. A successful URL retrieval does not prove every page was read.
- Image upload/OCR, streaming, durable chat history, and automated conflict detection are not implemented/confirmed in this pass.
- Other deployments need the feedback migration before optional issue categories and comments can be stored. The connected Supabase project was updated; no other database was changed.
- Search fallback and URL Context require a valid Gemini key and a model that supports the requested tools. If URL Context is unsupported, the client retries Google Search only; if that also fails, it returns to internal evidence.
