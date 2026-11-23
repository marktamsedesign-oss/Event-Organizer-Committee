# Pasko ng Angkan 2026 — v2.10: Members name suggestions + birthday-based registration

## What changed

The existing Registration form remains intact. For registration types other than **Family**, the Name field displays **only matching names** from the separate Google Sheets `Members` tab as the user types (first, middle, or surname, with tolerance for minor misspellings). Tapping a suggestion inserts the full name; no DOB, age, member ID, subtitle, or helper text appears **inside** the dropdown. Manual entry remains available when a name is missing.

When someone is selected, their birthday determines a suggested registration type **as of the event date, 13 December 2026**:

| Age on event date | Type suggestion |
|---|---|
| 0–12 | Kids |
| 13–20 | Youth |
| 21+ | Adult: user must choose Working Adult or Non-Working Adult |
| Missing or invalid date | Choose registration type manually |

The suggested type can be overridden. Family entries are manual, and Visitors remains an available manual choice. Registration prices, receipts and background batch sync are unchanged.

`Members` is **read-only**: this update never writes to it, and does not add any columns to `Members` or `Registrations`. The browser receives only a member ID, assembled display name, and birthday-derived group. Birth dates and other sensitive Members columns are not transmitted to the browser.

The names cache is tied to the signed-in user and kept locally for up to 90 days so previously downloaded suggestions can work offline. Signing out deletes this extra cache. Browsers may clear it under storage pressure. This is simple local fuzzy matching (not an external AI/LLM service).

## Install safely

1. Back up the Google spreadsheet and current v2.9.9 GitHub repository first.
2. **In the spreadsheet**, ensure there is a tab literally named `Members` with these ten columns in row 1, in this exact order:

   `ID`, `First Name`, `SurName`, `Middle Name`, `Suffix`, `Date of Birth`, `Invited by`, `Recorded Date`, `Status`, `Remarks`

   Keep existing data untouched. Each person should have a distinct, nonblank `ID`. Birthdays should ideally be genuine Google Sheets date cells; ISO dates (`YYYY-MM-DD`) or recognizable textual dates are also supported.
3. In **Extensions → Apps Script**, replace `Code.gs` with the `apps-script/Code.gs` from the ZIP. Save. **Do not run `setupDatabase()`** and do not delete/reorder any sheet columns.
4. Use **Deploy → Manage deployments → Edit → New version → Deploy**. Confirm the published `/exec` URL still matches `assets/js/api.js`.
5. On GitHub, update the paths from the PATCH ZIP, keeping their folder structure, then commit and push. The changes are `index.html`, `assets/js/api.js`, `assets/js/app.js`, **new** `assets/js/member-autocomplete.js`, `assets/css/style.css`, `sw.js`, and `apps-script/Code.gs` (backend updated in step 3).
6. Open the site online, wait for the GitHub Pages deployment to complete, and sign in. Open **Registration**, type two or more letters of a member's first or last name, and select a suggestion.
7. Verify an age-13 or age-20 member becomes Youth; an age-21 member asks for an Adult type; Family shows no suggestions. Test one registration and check that it appears **once** in the `Registrations` sheet after background Sync.
8. Reopen the page offline **on the same device** after one successful online catalog read. Previously downloaded names should still be suggested.

If the `Members` tab is missing or its headers do not match, the app keeps the ordinary manual registration form usable, but suggestions will not be available until the sheet is corrected. It **does not** silently clear or modify the sheet.

## Privacy and limitations

- Access to name suggestions requires an active signed-in app session. The shared group password is not strong individual authentication; restrict access to this web app and spreadsheet as appropriate.
- The browser's offline name cache is **not separately encrypted**. Do not use shared devices for personal registration details; sign out when done.
- The backend computes a category from DOB but does not send DOB itself. DOB-based grouping is a suggested classification; staff can correct exceptional cases manually.
- Ambiguous text dates such as `02/03/2012` are interpreted as month/day/year; use real Sheets date values or ISO format to avoid ambiguity. Unambiguous day/month/year text is also handled.
- The offline cache and queued writes require browser site storage. Clearing site data can erase unsynced changes. Sync before changing devices or signing out.
- True Google Sheets production behavior must be verified after deployment; the automated tests used mocked spreadsheet and API responses and did not access or modify your live data.

## Tests executed before release

- `node tests/v210_members_backend.test.js` — read-only Members parser, header mismatch handling, date boundary checks (12/13/20/21), inactive status exclusion, no DOB exposed; passed.
- `python tests/v210_members_browser.test.py` — actual Registration modal, names-only suggestions, adult manual choice, Family bypass, keyboard actions, offline cached names; passed in Chromium.
- `python tests/v299_offline_browser.test.py` — offline queued registration/Finance/task/Food edits survive reload and sync exactly once; passed.
- `node tests/v299_service_worker.test.js` — app shell including new autocomplete JS cached, API not cached; passed.
- `python tests/v298_periodic_sync.test.py` — background 30-minute, manual refresh, pending-write behavior; passed.
- Existing Finance/Payables and batch registration backend and browser tests; passed.

There is no new database migration function and no `Members` write operation in this release.
