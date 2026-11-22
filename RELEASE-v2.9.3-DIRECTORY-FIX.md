# v2.9.3 — People & Roles directory reliability fix

## What was wrong
- The UI displayed **No matching people** when a signed-in user's directory had not loaded. This was a loading error, not a search result.
- The verified snapshot lived only in sessionStorage, so it could disappear when a tab was reopened.
- The previous sheet validator allowed zero visible users if the raw Users sheet contained rows.
- A bootstrap with zero/missing users could replace a valid cached directory.

## What is fixed
- A clear **Loading people & roles** indicator and a **Retry loading** action on failed initial loads.
- Persist the last fully verified snapshot in browser localStorage with a 7-day retention limit (fallback to sessionStorage); render last confirmed data before refreshing.
- Verify backend-provided visible counts exactly for all nine data collections plus archived committees, and reject responses missing the logged-in user.
- Never overwrite last confirmed people with an empty/unverified bootstrap.
- All existing finance, task, registration, committee, member, and background write functionality is preserved.

## Install — backend FIRST
1. Back up your Google Spreadsheet and GitHub repo.
2. In the bound spreadsheet's Apps Script editor, replace `Code.gs` with `apps-script/Code.gs` from this package. Save and Deploy > Manage deployments > Edit > **New version** > Deploy.
3. No database migration or `setupDatabase()` run is required for v2.9.3; this release adds no columns/sheets.
4. Replace the corresponding frontend files in GitHub (at minimum `assets/js/app.js` and `index.html`) and push.
5. Reload the site. Sign in once if necessary; wait for **Synced**. Open ☰ > People & roles summary and verify expected people. Reload and check that the directory stays visible immediately while a fresh server read completes.
6. If the frontend says **Deploy v2.9.3 Code.gs**, the website is still reaching an older Apps Script deployment URL/version. Verify `assets/js/api.js` is pointing to your updated `/exec` URL.

## Verification
- Open browser developer console: no uncaught errors.
- Empty/partial server responses cannot replace confirmed records; a clear loading or retry state is shown instead.
- New browser/device without any previous snapshot needs one successful sync before showing the directory.
- Last confirmed data is cached **on that device**: do not use a shared device for sensitive registration data. Sign out to clear its local copy.
- Cache is not proof that a new edit reached Sheets: use the Sync status and verify changes when required.
