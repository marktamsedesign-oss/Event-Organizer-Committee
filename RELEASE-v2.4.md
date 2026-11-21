# Pasko ng Angkan 2026 — v2.4 release

This package contains the **complete GitHub Pages frontend and updated Apps Script backend**. It builds on all previous v2.1–v2.3 features, including Receivables, editable committee assignments, committee archive/restore, add-user menu, and safe background write retries.

## What's new

1. **Accidental zoom guard.** The app intercepts common Ctrl/Command+wheel, keyboard +/−, mobile double-tap and browser gesture zoom triggers. Some browser-menu and OS accessibility zoom controls remain outside a website's control.
2. **One Sync & Refresh button in the upper-right corner.** It shows a small numbered badge when edits are pending or unconfirmed. Click to fetch new Sheets data, or safely retry unconfirmed writes with the original request ID. Normal edits still save automatically.
3. **Upper-left menu → Copy all committees.** Produces a readable group-chat message that includes all active committees, their descriptions/responsibilities, Head(s), Support members/sub-team roles, assigned tasks, priorities, due dates, completion statuses, and task-count progress. Task completion attribution is also included. Review the text and copy it to Messenger, Viber, or WhatsApp. The existing database has no separately defined nested subcommittee table; Support responsibilities are used for this breakdown.
4. **Refresh without a blank screen.** Signed-in users see the last confirmed state immediately on reload (when a browser-tab snapshot is available). Every load still requests fresh committee data from Apps Script; on success the visible page updates in place. The previous active tab remains selected, and slow or failed refreshes do not erase the existing view.
5. **Binary task completion.** Individual task percentage bars and progress-update forms are removed. Task cards have at most **Edit** and **Complete** icon buttons, depending on permissions; already-completed tasks have no Complete button. Completion history is displayed within the task details, showing **who completed it and when** using the `TaskUpdates` audit trail. The original `Tasks.progress` sheet column remains for compatibility, with 100 assigned automatically on completion.
6. **Go to tasks for this committee.** A dedicated checklist icon on every committee card opens the To-do list filtered to that committee. Old search and status filters are cleared so its tasks are visible. Clicking the empty area of the card also works.
7. **Committee progress stays automatic:** `round(completed tasks ÷ all tasks × 100)`; committees with no tasks show 0%. Task details are editable by Directors/Committee Heads, while assigned committee members can mark tasks Complete.

## Installation (both sides must be updated)

1. Back up the **live Google Sheet** and existing GitHub repository before replacing files.
2. Extract the ZIP; **do not upload the ZIP as a single file to GitHub**. The directory `Event-Organizer-Committee-main` contains all repository files. Copy its contents into the **root of your existing repository**, retaining `assets/`, `apps-script/`, and `.github/` subfolders.
3. Open the Apps Script project attached to your live spreadsheet (**Extensions → Apps Script**). Replace the contents of its `Code.gs` with this package's `apps-script/Code.gs`; save.
4. If the spreadsheet still contains the old `Users.pinHash` column, first run `migrateRemovePinColumn` from the Apps Script function dropdown. Do not run it if the column was already removed. With a previously working v2.3 sheet, **no new sheet columns or migrations are required** for v2.4.
5. Run `setupDatabase` **only if you still need to initialize missing v2.3 sheets** such as `WriteReceipts` or initial records. This function never clears sheets to resolve schema mismatches.
6. Apps Script → **Deploy → Manage deployments → Edit → New version → Deploy**. Check that `assets/js/api.js` points to the matching deployed `/exec` URL. Do not put the actual `GROUP_PASSWORD` value into source code or GitHub; set it through Apps Script **Project Settings → Script properties**.
7. Commit and push the frontend to your deployment branch, verify the GitHub Actions/Pages deployment succeeded, and hard-refresh the published site once to load `?v=2.4` assets.

## Acceptance checklist

- A committee card has a **Go to tasks** checklist icon; clicking it filters the task list to that committee even if another status/search was previously selected.
- Task cards have no progress input or progress percentage. **Complete** records the current account's name and a server-side timestamp; after Sync & Refresh the entry appears on the task and in expandable Completion history.
- Committee cards and Reports compute progress from the number of completed tasks.
- The upper-left menu generates the entire group-chat report; copy it and paste it to a test chat.
- The top-right unified icon shows the number of pending/unconfirmed writes, retries failed confirmations, and refreshes without removing the visible content.
- Refreshing a tab with an existing session restores the last confirmed view and still fetches the new data from Google Sheets.

## Notes and limitations

- **Backend deployment is required for v2.4 completion attribution.** v2.3-compatible responses do not include the new `completedByName`, `completedAt`, and `completionHistory` fields. Existing audit logs are preserved; no sheet layout change is needed.
- If an older task was manually marked Completed but has no matching `TaskUpdates` entry, the app cannot reliably identify who or when; it shows that historical attribution is unavailable rather than inventing it.
- The page caches the **last confirmed dataset in this browser tab only**, including event records. It does **not** cache the shared password or unsynced writes. Do not use a shared device without signing out.
- Pending writes require the browser to remain open and connected. The unsynced count and Sync & Refresh control are **not an offline queue**; do not close the page until it says **All changes saved**.
- JSONP reads and a group password are appropriate only for low-sensitivity group planning. Do not put private identity or financial account details in this spreadsheet. Browser or OS accessibility zoom cannot be fully disabled.
