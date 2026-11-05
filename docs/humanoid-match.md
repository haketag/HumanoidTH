# Humanoid Match MVP

Routes: `/match?industry=healthcare&task=guidance` and `/robots/[id]`.
The robot registry links to Match on mobile; the desktop sidebar has a direct entry.

## Audit and methodology

The existing Next.js App Router uses Prisma/PostgreSQL, server components,
cookie-based Thai/English selection and global CSS tokens. RobotModel contains
descriptions, primaryUseCase, sourceMeta and officialUrl, but no verified capability
specifications or capability evidence relationships. Contribution has a real
relatedRobotModelId foreign key and a review status. No robot detail route existed.

The audited database contained 17 robot records. Metadata recorded source titles
and platforms, not capability assertions. primaryUseCase often contains importer
notes. One linked research entry was a NEEDS_REVIEW seed with a non-web URL.

The MVP therefore deliberately abstains from matching all current records.
It never extracts capabilities from names, descriptions, categories or an LLM.
Each task requirement remains Not verified. No score or rank is calculated.
Registry browsing is explicitly separate from results and includes service robots
without falsely classifying them as humanoids or suitable candidates.

Detail research is restricted to public Contribution rows linked by the existing
foreign key, with contributionType research_paper and a usable HTTP(S) source.
Review status is displayed. A linked paper is never treated as task evidence.
No publication year or independent verification is inferred from creation dates.
No external references are fetched, data is not inserted, and no migration is needed.

## Checks

`npm test` includes taxonomy, invalid selection, abstention and URL validation tests.
`npm run typecheck` checks integration. `npm run build` verifies production output.
The existing lint command requires interactive ESLint setup; this feature does not
silently change project-wide lint configuration.

Future matching requires an audited capability evidence relation, including source,
review status, and robot identity. Until then, an empty match result is intentional.
