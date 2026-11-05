# Favorite Basket

Open `/robots`, select a star, then open `/favorites`. The detail page uses the same
star component. Both desktop and mobile navigation link to Favorites.

Persistence is browser-local, not account-synced. The existing cookie-based account
mechanism is not used as an authenticated identity. No database migration or writes
are introduced. localStorage stores only validated, deduplicated RobotModel IDs
under `humanoidth:favorites:v1` (maximum 200). Clearing browser data removes bookmarks.
Other tabs receive storage changes. Rapid clicks use a synchronous ref to avoid
stale React state. Storage failures leave the prior visible state intact and show
an error. Corrupt stored values show an error rather than crashing the catalog.

`GET /api/favorites?ids=[...]` validates the list, reads current database records,
and omits deleted IDs. It returns only existing public robot profile fields. No
user data or inventory is included. Images use the same existing resolver as the
catalog. The client renders loading, empty, storage-error and API-error states;
API failure preserves saved IDs and offers retry. Failed images show a placeholder.

Tests: `npm test` covers storage validation, toggling, duplicate handling and invalid
IDs. Browser checks exercised saving, refresh persistence, a one-item favorites
list, detail-page state, removing, refresh after removal, invalid API requests,
unknown IDs, corrupt storage, and a 390px mobile viewport. Core flow had no captured
page errors. Database outage and OS-level storage blocking were not simulated.

Humanoid Match behavior, authentication, ingestion and robot data are unchanged.
