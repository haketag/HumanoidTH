# Baseline audit and fixes

Audit scope: the checked-out `HumanoidTH` web app and its existing PostgreSQL schema at the local working-copy baseline. This is a local audit log, not a claim that every upstream route or deployment configuration has been exhaustively security-certified.

| Finding | Change made in this working copy | Verification / limit |
|---|---|---|
| Public/private inventory and graph data could be mixed | Private inventory, database browser, operator pages/actions, ingestion/export, and map reanalysis require a signed admin session; public graph APIs omit private records | Anonymous HTTP checks and graph response inspection passed in the prior local run; repeat after final build |
| Map fallback wrote plausible-looking mock clusters after AI failure | Removed fabricated cluster fallback; public map uses cached real records and admin-triggered reanalysis | `check:no-mock-data`; final `/map` request returned HTTP 200 |
| Gemini model was hardcoded and key was sent in URL parameters | Model is configured with `GEMINI_MODEL`; API keys use the request header | Typecheck/build; provider call cannot be exercised without local key |
| OpenAlex abstract reconstruction/date handling could fabricate or lose information | Reconstruct indexed abstract tokens in order; preserve year-only precision and store excerpts | Unit tests cover reconstruction and date precision |
| Robot relevance heuristics had alias/negation false positives | Added token-boundary handling, aliases, Thai negation checks, and funding/Android false-positive tests | Classifier unit cases pass |
| Contribution status filters did not match the Prisma enum | Use `ReviewStatus` values and distinguish invalid filter, database failure, and empty result | Final valid/invalid filter requests both returned HTTP 200; invalid status notice rendered |
| User-selected role could be mistaken for authorization | Research roles only change response guidance; retrieval always uses the same public allowlist | Unit and final API checks passed |
| Research Assistant plans were browser-local and not versioned in HumanoidTH | Added private capability-token ownership, `LivingLabPlan`, revision snapshots, source validation, and additive migration | Migration applied; final API create/read/update/delete and two-owner isolation checks passed |

## Database migration baseline

The database originally had all application tables but no `_prisma_migrations` history. Before changing schema, a read-only comparison matched the checked-out initial migration against the database: all 12 initial tables, 5 enums, columns, indexes, and constraints matched; there were no extra application tables or constraints. The initial migration was then marked applied in Prisma metadata and the new additive migration was deployed. No source/seed records were rewritten or deleted.

## Known follow-up work

- Verify provider behavior with a team-owned Gemini key and test account before enabling external synthesis.
- Review the upstream branch/repository and perform a team fork/commit workflow only in the team's GitHub repository; this local copy has not been pushed.
- Conduct source-support review and user testing before any claims about research quality or Living Lab usefulness.
