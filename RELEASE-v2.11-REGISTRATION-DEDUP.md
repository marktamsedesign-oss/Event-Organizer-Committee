# Pasko ng Angkan 2026 — v2.11 Registration Duplicate Protection

This update builds on **v2.10** and keeps the existing GitHub Pages app, spreadsheet structure, offline queue, birthday-assisted name suggestions, Payables, Finance, Food, and 30-minute synchronization.

## What's new

- **Exact full names are blocked** across individual registration categories, even if the registration type differs. Comparison ignores capitalization, accents, extra spaces, common punctuation and the order of name tokens. Example: `Maria Garcia Reyes` / `Reyes, Maria Garcia` cannot be registered twice.
- **Similar names only raise a warning**, never require a second confirmation and do not disable Save. For example, a minor spelling error or an omitted middle name may be flagged. This is a heuristic, not an identity decision.
- **Family names are checked against other Family registrations**, not individual attendees. `Santos Family` and `Santos Household` are treated as an exact match. Two registrations of the same family name are blocked.
- **Offline pending registrations are included** in the frontend checks. Registration is queued as before, with Google Sheets protection checked again on sync.
- **Family** can record a manually entered number of attendees **1–100**. Each Family record continues to incur the one-time family contribution of **₱300**, regardless of how many family members attend.
- **All non-Family categories** (Working Adult, Non-Working Adult, Youth, Kids, Visitors) **automatically show 1 attendee, locked**. The frontend and backend enforce this rule.
- Members autocomplete displays **names only**. Based on Date of Birth as at **Dec 13, 2026**: Kids 0–12, Youth 13–20; age 21+ asks for Working or Non-Working Adult.
- The existing `Members` sheet is read-only. No schema changes or new columns required.

## Install v2.11

**Back up** your current GitHub repository and Google Spreadsheet before any update.

1. In Google Sheets, open **Extensions → Apps Script**. Replace the existing `Code.gs` with `apps-script/Code.gs` from this update and save. **Do not run `setupDatabase()`**; this release does not need a migration.
2. Select **Deploy → Manage deployments → Edit → Version: New version → Deploy**. Keep the same `/exec` endpoint. Make sure the deployed account can access the spreadsheet.
3. Update your GitHub repository with the included frontend files, preserving paths, especially `index.html`, `assets/js/app.js`, `assets/js/registration-duplicates.js`, `assets/css/style.css`, and `sw.js`.
4. Commit and push; confirm GitHub Pages deployment finished. Open the site online once to install the updated offline cache.
5. Test in a **backup or test spreadsheet**: register a new participant, try the same name in a different category (blocked), try a typo (warn only), add a Family with 5 attendees, and check that a non-Family type remains 1.
6. To verify multi-device protection, use two browsers sharing the same test sheet. Register the same name in both; only the first confirmed backend save should be accepted.

**IMPORTANT:** If you update GitHub without updating Apps Script, duplicates may still be saved from simultaneous devices. Both components are required for authoritative enforcement.

## Sync behavior / limitations

- Local checks operate on the **records available on that device**, including unsynced registrations. If another device adds a registration while this device is offline, the conflict may only become known when the pending batch reaches Apps Script.
- Apps Script validates an entire registration batch **before any records are written**. If a duplicate is detected, the batch is rejected and stays in *Needs Sync* rather than silently overwriting data. In Registration, remove the rejected duplicate (the entry marked Needs Sync); the app then requeues the other records with a fresh batch ID. Do not assume the rejected batch was accepted.
- Similar names are not automatically merged. A spelling difference may represent a real different person.
- Existing records are not edited, merged, or deleted by this upgrade. Old duplicates remain available for manual review.
- The shared group password is not secure individual authentication. Keep the spreadsheet private, use a strong non-default password, and sign out on shared devices because offline caches may include participant names.

## Tests

See `tests/TEST-RESULTS-v2.11.md`. Local test suites use simulated Apps Script/Sheets responses; **the live production spreadsheet has not been accessed**.
