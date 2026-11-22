# Pasko ng Angkan 2026 — v2.9.4 People & Roles loading fix

## Confirmed cause of the “0 of 0 people” symptom
`Code.gs` v2.9.3 does `read_("Users").filter(active).map(sessionUser_)` in `getData_()`. That `sessionUser_()` removes the `active` flag. The frontend then does `users.filter(u => active(u.active))`, eliminating every user. **Both the frontend and backend were valid independently, but their user shapes were inconsistent.** The frontend now treats a missing `active` field in the already-filtered API user list as active. An explicitly inactive user remains excluded.

## Additional bug in v2.9.3
`renderPeopleRoles()` waited for `fullSnapshotLoaded`, a full **nine-sheet** authenticated `getData` fetch, even though the public `bootstrap` response already contained the complete active People, Committees and CommitteeMembers lists. If any other sheet failed or the full-data contract/version mismatched, People & Roles remained unavailable regardless of reloads.

## Fix
- People & Roles now uses verified `bootstrap` users + committee members immediately, independent of the nine-sheet fetch.
- Lightweight directory data survives a page reload without relying on the full-data cache.
- Any failed full-data request leaves the directory visible and reports an explicit status: tasks/other records need sync.
- Compatible with both v2.9.2 and v2.9.3 `apiVersion:29` bootstrap responses; v2.9.3 response counts are checked if present.
- People sorting and copy still work; task totals are labeled “tasks syncing” until the full task list is verified.
- Empty-directory errors are not disguised as “No matching people.”

## Deployment
**Frontend-only update.** Replace `index.html` and `assets/js/app.js` on the GitHub Pages branch. Keep your existing `assets/js/api.js` URL; do not overwrite it with a different deployment URL. No Apps Script schema migration or new deployment required solely for this fix.

If other tasks/finance/registration continue to fail, inspect the visible connection status message, check Apps Script Executions, and verify the deployed backend really matches v2.9.3. This frontend fix deliberately does not claim to repair a failing server-side `getData` request.

**Tests:** See v2.9.4 testing notes in the final chat. Local tests use isolated browser and mocked Apps Script responses, not your live spreadsheet.
