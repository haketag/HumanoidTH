# Evaluation plan and local results

These checks verify software behavior. They do not verify source truth, user benefit, or clinical outcomes.

## Automated checks

From the final local working tree:

- `pnpm typecheck` — passed.
- `pnpm test` — passed, 20 unit tests.
- `pnpm check:no-mock-data` — passed.
- `git diff --check` — passed.
- `pnpm build` — passed; Next production routes were generated, including both Research Assistant APIs.
- `prisma migrate deploy` — passed after read-only baseline verification; the additive `LivingLabPlan` and revision tables exist.
- The separate legacy Python test suite was not run: this Windows environment has no installed Python interpreter or project virtual environment. It is outside the Next.js Research Assistant runtime.

## Final-build local API checks

The production server and local PostgreSQL were exercised with a uniquely named temporary plan. The plan was deleted after checks. The database then contained 6,719 source records, 17 robot models, 4 contributions, 4 perspective annotations, 0 Living Lab plans, and 0 plan revisions.

| Case | Expected | Result |
|---|---|---|
| `/research-assistant` and search for `NAO robot` | Page loads; public evidence with IDs/URLs | HTTP 200; 11 evidence records |
| Unique unmatched query | Scoped no-results response | `no_results`; explicitly does not claim no research exists |
| Gemini absent | No AI-generated substitute | `aiStatus=not_configured`; extractive result returned |
| Invalid/oversized plan body | No write | `409` for forged evidence ID; `413` for oversized body |
| Plan create/read/update | Owner can reload source snapshot; each save appends revision | `201`; two revisions retrieved after update |
| Different owner token | No access to saved plan | Empty plan list |
| Cross-origin mutation | Rejected | `403` |
| Anonymous delete | Cannot remove another owner's plan | `404` |
| Owner delete | Removes plan and cascading revisions | `200`; subsequent list empty |
| Robot/contribution contextual links | Source pages hand off a prefilled question | Both labels present in rendered HTML |
| Contribution review filter | Valid and invalid filters render without DB enum error | Both HTTP 200; invalid filter notice present |
| Anonymous private routes | Redirect to admin login | `/admin`, `/data-pulls`, `/database`, `/inventory`: `307` |
| Public routes | Remain available | `/robots`, `/contributions`, public inventory, `/map`: `200` |
| Anonymous export | Denied | `401` |
| Graph with `includePrivate=true` | No private nodes | `0` private nodes |

The browser rendered the final Research Assistant page. The plan persistence round trip was verified against the live HTTP API; the UI controls themselves were not clicked end-to-end after this final build.

## Not verified / future evaluation

- The local `.env` has no Gemini key/model. Provider generation, provider outage, semantic citation support, provider quota, and actual per-user consent behavior remain untested. The route correctly remained in no-key mode locally.
- The in-memory Gemini limiter is best-effort per process; production needs provider billing limits and a shared rate limiter.
- Private-contribution exclusion is enforced in the query, but no private adversarial fixture was inserted to test it.
- No person has adjudicated source support or retrieval recall. Build a 20–30 item expected-result set with a researcher and score retrieval recall, citation validity, semantic support, completeness, abstention, latency, and cost separately.
- No usability study, field deployment, participant recruitment, robot control test, or clinical outcome test was performed.
