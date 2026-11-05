# Local completion: HumanoidTH and Living Lab Research Assistant

The working copy is integrated with the HumanoidTH Next.js app and its local PostgreSQL database. The Research Assistant supports evidence retrieval, source-linked HRI feasibility planning, durable plan revisions, and optional Gemini synthesis. It has not been field-tested or clinically validated.

## User flow

1. Open a robot or public contribution and hand its name/title to Research Assistant, or start at `/research-assistant`.
2. Select Student, Researcher, Company, or General guidance. This changes the guidance, never the access scope.
3. Search the current public corpus: accepted source records, robot registry entries, and approved public contributions. Review their IDs, status, excerpt, and source URL.
4. Read the limitations and unknowns. A missing result is scoped to this corpus and does not assert that a source does not exist.
5. Enter participants, setting, activity goal, duration, and staffing; generate and edit a feasibility/usability checklist.
6. Save the plan to PostgreSQL. Plans are private to a random HttpOnly browser capability token; edits create append-only revisions with an optional learning/feedback note. Reopen, inspect revision notes, delete, or export Markdown.

The feature does not control robots. The plan template asks teams to obtain consent, agree to stop conditions, check accessibility and staffing, observe task completion and comfort, and avoid claims about clinical or wellness efficacy.

## Gemini behavior

- Retrieval and plan building work without Gemini.
- With both `GEMINI_API_KEY` and `GEMINI_MODEL` configured on the server, an adult user may opt in for each search. The question and retrieved public records are then sent to Google Gemini for a structured draft.
- The server validates JSON shape and citation numbers against the retrieved record set. This does not prove that citations semantically support the generated text; every claim still needs human review.
- Gemini use is best-effort limited to five requests per minute per forwarded client address in one server process, with output capped at 1,024 tokens. In-memory limits are not a substitute for provider quotas or a shared production rate limiter.
- Without consent or configuration, or if Gemini fails, the app labels the mode and retains the extractive search result without fabricated replacement records or claims.
- Never enter names, health details, or other personal information in questions. No private inventory, private contributions, or notes are sent through this route.

## Evidence policy

- `ACCEPTED` and `APPROVED` are workflow states, not independent verification.
- Robot registry specifications, contribution descriptions, and research findings are different evidence types.
- Records without abstract/excerpt text are marked metadata-only; they cannot support study-outcome claims.
- The prototype does not infer health benefit, treatment efficacy, or safety certification. It does not algorithmically resolve conflicting study results or provide a systematic review.
- A saved plan retains its evidence snapshot and capture time. Reopening reports source records that are no longer in the current public corpus.

## Privacy and persistence

- Plan ownership uses a 256-bit random browser token stored in an HttpOnly, SameSite=Strict cookie. Only its SHA-256 hash is stored in the database; API reads and mutations are scoped to that hash.
- The guest token is browser-specific. Clearing cookies loses access to the plan; there is no account recovery or cross-device sync in this prototype.
- Plan JSON is size bounded, the API accepts only canonical evidence IDs still visible in the public corpus, and mutations reject mismatched Origin headers.
- The API retains up to 20 plans per browser token and 100 revisions per plan.
- Migration `20261101000000_living_lab_plans` adds two tables and indexes. The prior seed/database rows remain intact.

## Verification record

Run from the project directory:

```powershell
pnpm db:generate
pnpm typecheck
pnpm test
pnpm check:no-mock-data
pnpm build
```

Automated checks cover type safety, 20 unit cases, classifier false positives/negation, OpenAlex abstract/date handling, role-specific guidance, abstention, plan validation, origin validation, rate limiting, and owner-token hashing. Final HTTP API persistence and privacy-route checks are recorded in `docs/EVALUATION.md`; the UI control flow was not manually clicked through after the final build.

## Remaining validation

- Gemini key/model are not configured in the local `.env`, so remote synthesis and its provider failure states have not been exercised.
- Conflict detection, systematic evidence review, human source-support adjudication, retrieval recall benchmarking, and user studies remain out of scope.
- No physical robot, participant recruitment, field study, or clinical outcome test was performed.
- The code remains in this local working copy on `feature/research-assistant-living-lab`; no team fork or push/deployment was made. A commit is pending because this clone has no Git author name/email configured, and I did not invent an identity.
