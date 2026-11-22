# Pasko ng Angkan 2026 — v2.9

## What changed

1. **Persistent login:** Replaces the old six-hour Apps Script cache with a hashed, revocable session record in `PersistentSessions`. The browser keeps the login token across refreshes and browser restarts. The session is valid for **365 days of inactivity**, and activity during its final 90 days renews it for another year. Signing out revokes the token. Deactivated accounts also cannot use saved tokens. An older v2.8 token may require **one final login** immediately after this backend upgrade because it was never stored in the new session ledger.
2. **All-sheet sync:** The backend reads Users, Committees, CommitteeMembers, Tasks, TaskUpdates, ActivityLogs, FinanceEntries, FoodItems, and Registrations in a single locked read. The response includes a completeness marker and raw sheet record counts. The frontend rejects incomplete responses, retries automatically, retains the last confirmed view, refreshes on page load and roughly every 30 seconds when active, and warns about unmatched task/user IDs under Reports → Data checks. Backend write receipts remain idempotent for retried request IDs.
3. **Simpler group-chat reports:** People & Roles now emphasizes Head, Support, assigned tasks, remaining work and completion—no “Position: Not listed” or “System role”. Both Simplified and Detailed committee sharing formats avoid redundant text and display readable due dates. Detailed reports still include full team roles and individual tasks; Simplified reports limit long lists.
4. **Participant / visitor registration:** New Registration tab and Add-menu action. Registration types: **Family, Working Adult, Non-Working Adult, Youth, Kids, Visitors**. Family entries can contain multiple attendees; all other types represent one person per entry. Includes search, counts, edit (original registrar or event management), and reversible-at-sheet-level archive. No contributions or fees are automatically calculated.
5. **Browser icon and loading indicators:** Adds a custom favicon and an iOS home screen icon. Sign-in and registration forms now show animated, accessible loading overlays. The unified Sync icon animates during background activity, and a badge indicates unconfirmed writes.

## IMPORTANT — upgrade both GitHub and Apps Script

1. **Back up your Google Sheet** (File → Make a copy), and save a copy of your existing repository.
2. Upload the v2.9 repo files to the GitHub branch that publishes your website. Keep your repository **private** if you do not intend the project code or backend URL to be public. Do not upload participant information to GitHub.
3. In the **Google Apps Script editor bound to the correct spreadsheet**, replace `Code.gs` with `apps-script/Code.gs` from this package and save.
4. From the Apps Script function dropdown, select `setupDatabase` → **Run**. This validates existing headers and creates two additional database sheets: `PersistentSessions` and `Registrations`. Existing committees, tasks, people, finance, and food records are preserved. If the schema check fails, do not delete sheets or reorder headers without a backup.
5. Go to **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Verify that the `/exec` URL matches `assets/js/api.js`. If a new URL was issued, update `API_URL` in that file and push it too.
6. Allow GitHub Pages to deploy, then reload the website. **Log in once after the upgrade** if you were still carrying an old six-hour session token.
7. Confirm that the Registration tab can create one harmless test entry, that it appears in the `Registrations` sheet, and that the page still recognizes you after closing and reopening it. Confirm finance and tasks load along with committees.

### If a sync warning appears

The existing screen stays visible. Use the **Sync/Refresh** icon (upper right) to retry. The badge counts pending changes. A background edit still needs server confirmation before it is safe to navigate away. If you see a version mismatch, update the Apps Script deployment. If Reports → Data checks shows unmatched assignee IDs, use a Director account to correct those assignments in the source database; v2.9 does not guess who those IDs belong to.

### Security and privacy

- The shared group password is convenience-level access control; it is **not appropriate for sensitive data**. Set a non-default `GROUP_PASSWORD` in Apps Script Project Settings → Script properties. The ZIP does not contain participant records.
- The persistent token lives in the signing-in browser's local storage; use **Sign out** on a shared device. Tokens are stored hashed in Google Sheets and become invalid when revoked, the user is deactivated, or they expire after prolonged inactivity.
- The GitHub Pages + Apps Script JSONP architecture transmits a token in a GET query string for reads. Do not collect government IDs, personal health information, contact details, or private financial details through these forms. Restrict spreadsheet sharing to trusted organizers. For stronger authentication/private data, migrate to a proper authenticated backend.
- Registration names are read by any signed-in member of the group. Consent and local privacy obligations remain the event organizers' responsibility.

### Verified tests

- Google Apps Script logic under a local mocked spreadsheet: persistent session after cache eviction, login, registration creation/edit/archive, snapshot validation, logout/revocation.
- Browser test using a simulated API: incomplete response rejected/retried, login restored on a new page, registration spinner, recorded family attendee count, task-friendly summaries.
- JavaScript parsing and file/package integrity.

**Not yet verified:** live Apps Script deployment, the actual network connection to the original Google Sheet, or users' browser-specific behavior. These require running the upgrade against your own account and deployment.
