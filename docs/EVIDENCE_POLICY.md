# Research Assistant evidence policy

## Retrieval allowlist

- Source record: `relevanceStatus=ACCEPTED`.
- Contribution: `visibility=public` and `verificationStatus=APPROVED`.
- Robot model: registry records used by the public robots page.
- Private inventory, private notes, private contributions, and operator-only fields are not queried by this assistant.

## Labels and claims

- `ACCEPTED`/`APPROVED` describe workflow state; they do not mean independent quality or fact verification.
- Robot registry entries describe catalog data, not research findings.
- An empty excerpt is metadata-only. Do not use it to assert study outcomes.
- Search absence means “not found in the searched corpus,” not “no evidence exists.”
- Do not merge relevance, source quality, model confidence, and safety into one score.
- The app does not detect or resolve contradictions between studies. Compare population, robot/intervention, setting, methods, and outcomes in the original sources.
- Plans are for feasibility/usability observations. They are not treatment, safety certification, or clinical/wellness efficacy guidance.

## Citations and AI

- Citation numbers are generated from the exact server-retrieved records and link to the corresponding evidence card.
- Plan writes accept IDs only when they still resolve to the allowlisted corpus. User-supplied titles, excerpts, URLs, and citation numbers are not trusted as evidence.
- Gemini is opt-in and gets only the question plus bounded public records. It cannot write to the database. The server rejects malformed output or citation numbers outside the retrieved set.
- A citation-number match does not prove semantic support. Review the complete source and limitations before reusing any AI-generated sentence.
- Never send personal identifiers, participant notes, or health information to Gemini.
