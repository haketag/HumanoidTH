# Feature specification: Evidence-to-Living-Lab Assistant

## Problem

HumanoidTH contains robot, contribution, and research records, but users still need to inspect sources and translate them into a cautious HRI wellness activity plan. The feature helps prepare a feasibility/usability session; it does not recommend treatment or predict wellness outcomes.

## Users and guidance

- **Student:** prompts for terms, study aims, methods, and source limitations.
- **Researcher:** prompts for population, setting, comparator, outcomes, and transferability.
- **Company:** separates listed robot capabilities/manufacturer information from deployment evidence; does not invent price or availability.
- **General:** plain-language overview.

Role selection never changes data permissions.

## Integrated flow

Robot registry and public contribution cards can prefill a query into `/research-assistant`. The route searches accepted `SourceRecord`s, `RobotModel`s, and approved public `Contribution`s. It shows status, source URL, excerpt, and metadata-only limitations. It gives the user a planning form for participant group/count, site, activity goal, session duration, staffing, and readiness gaps. Users edit the generated checklist, save it, reopen it, append a revision note, delete it, or export Markdown.

## Data and ownership

- `LivingLabPlan` stores editable context and an evidence snapshot.
- `LivingLabPlanRevision` stores each saved snapshot, timestamp, and optional learning/feedback note.
- A random HttpOnly browser capability token scopes private read/update/delete operations; the database stores only its SHA-256 hash. This is guest browser ownership, not account authentication, sharing, or recovery. A browser token may own up to 20 plans; each plan has up to 100 revisions.
- Server code re-resolves source IDs and accepts only currently public/approved records before create/update. The plan records which sources were available when saved; later changes are shown as stale IDs.
- Migration: `prisma/migrations/20261101000000_living_lab_plans`.

## AI boundary

Gemini is optional. It receives the user's question plus retrieved public records only after per-search 18+ confirmation and explicit consent. The model returns cited claims, limitations, and unknowns. The server checks JSON and citation-number membership; this is a format check, not semantic citation verification. A human must inspect the original source. If Gemini is missing or fails, retrieval remains extractive and the UI reports the mode. A best-effort in-memory limit allows five Gemini requests per minute per forwarded client address and caps output at 1,024 tokens; production deployment still needs provider quotas and a shared rate limiter.

## Out of scope

Robot motion/control, personal or health-record handling, emotion recognition, clinical advice, efficacy claims, automated conflict adjudication, systematic reviews, shared team accounts, cross-device plan sync, and field-study conclusions.
