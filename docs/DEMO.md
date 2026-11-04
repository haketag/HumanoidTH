# 3–5 minute local demo

## Start

1. Start the retained local PostgreSQL container: `docker start humanoidth-local-db`.
2. From this directory run `pnpm db:generate`, `pnpm build`, then `pnpm start -- --hostname 127.0.0.1 --port 3000`.
3. Open `http://127.0.0.1:3000/robots` and use **Ask Research Assistant** on a robot card, or open `/research-assistant` directly.

## Walkthrough

1. Choose **Researcher**. Ask about a known robot and an HRI wellness activity, without entering names or participant information.
2. Review the result, open a source, and point out workflow status, excerpts, limitations, unknowns, and what the result does not establish.
3. Enter a participant group/count, setting, activity goal, duration, and staffing. Generate and edit the readiness/feasibility plan.
4. Save it, add a learning note, save again to create a revision, reload the page, reopen the plan, and inspect the revision history and evidence snapshot date.
5. Export Markdown. Delete the temporary demo plan if desired.

## Gemini demonstration

Only when an administrator has configured a current `GEMINI_API_KEY` and `GEMINI_MODEL`, show the 18+ and external-data-consent checkbox. Explain that the question and retrieved public records go to Google Gemini. Without those settings, demonstrate extractive search and the visible no-key state; do not imply that synthesis ran.

## Claims to avoid

Do not say the assistant verified research quality, found every relevant paper, proved an intervention works, or tested a robot with participants. The plan is a human-reviewed feasibility/usability draft only.
