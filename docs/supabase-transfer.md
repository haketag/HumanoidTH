# Prisma database transfer to Supabase

Completed on 2026-11-06 (Asia/Bangkok).

Destination: **HumanoidTH**, project `tutoqruvehttrvebqpge`, Singapore.
Source: the PostgreSQL database configured by `DATABASE_URL` at transfer time.
The source was read in a repeatable-read, read-only transaction and was not modified.

| Table | Copied rows |
| --- | ---: |
| Contribution | 4 |
| Entity | 0 |
| OwnedInventory | 0 |
| PerspectiveAnnotation | 6 |
| PipelineRun | 0 |
| RobotModel | 17 |
| SourcePullJob | 32 |
| SourceRecord | 6,724 |
| StatsCache | 1 |
| SubmittedData | 22 |
| Triplet | 10 |
| User | 2 |
| **Total** | **6,818** |

All 12 table counts and full-row MD5 checksums matched the source snapshot.
Five foreign keys were added and validated after the import. Primary keys,
unique constraints, indexes, enum types, column defaults and existing IDs were preserved.

RLS is enabled on all imported tables. `anon` and `authenticated` have no table
privileges or policies: access is intended through the existing server-side Prisma
application, not public Supabase API clients. The internal `rls_auto_enable()`
event trigger function cannot be executed by public API roles.

Supabase migration history:

- `import_prisma_source_schema`
- `validate_imported_prisma_relationships`
- `restrict_internal_rls_event_trigger_execution`

The data snapshot is in the user's Windows Temp directory, outside this repository.
It contains database records and must not be committed or published.
`scripts/transfer-prisma-snapshot.mjs` is the local transfer helper, not an automatic
migration or seed command; rerunning its insert output against populated tables
will fail on duplicate primary keys.

## Application connection verified

The application's `DATABASE_URL` now points to the Supabase Session pooler on port
5432. A direct PostgreSQL read and a read through the application's Prisma Client
both succeeded: 6,724 source records and 17 robot models were returned by count.
Prisma remains the application's database client; the database provider is now
Supabase. The application has not been rewritten to use the Supabase REST API.

This import reproduces the actual source database. The source did not contain the
newer Company Portal or Living Lab tables present in the repository's Prisma schema;
those schema migrations must be reviewed and applied on Supabase before enabling
features that depend on them. Supabase Auth users were not created; the existing
application's `public.User` records were copied unchanged.
