# Pasko ng Angkan 2026 — v2.9.2 Quick Registration + Background Batch Sync

## What changed

Registration is now designed for rapid entry. **Add & Next** immediately queues a participant, clears the name and notes fields, and keeps the form open. **Save & Close** queues the last entry and closes the form. The selected category remains set while entering consecutive participants. Family entries can still specify multiple attendees.

The registration list and its totals update immediately, with **Queued**, **Syncing**, and **Needs sync** labels. The top-right Sync/Refresh badge shows the number of changes awaiting confirmation (not the number of server requests). **Queued is not the same as saved in Google Sheets.** Wait until the count clears before relying on the final data.

The browser groups newly entered registrations for about **1.8 seconds after the last entry**, or immediately after 20 entries, then sends them as **one Apps Script batch** per group (up to 20). If you continue registering, new entries form another batch. You can continue typing while a batch saves.

Pending registrations are written to the **browser's localStorage** before being shown as queued. They can be restored and re-sent after a reload or a connection interruption on that device, as long as site storage has not been cleared. When connection returns, the app retries unconfirmed registration batches automatically, or you may press the existing Sync/Refresh icon. Confirmed or retried entries retain their original IDs; batch requests retain their original request IDs to avoid duplicates.

## Important installation instructions

This upgrade **does require a new Google Apps Script deployment**. The old backend does not support the `saveRegistrationsBatch` action. Install the backend first, before letting anyone use the fast-registration form.

1. Back up your existing spreadsheet and GitHub repository.
2. From this ZIP, open `apps-script/Code.gs` and replace the corresponding code in **Extensions → Apps Script** for your spreadsheet.
3. **Do not delete or rename existing database sheets**. Existing v2.9.1 users, committees, tasks, finance, and registrations are retained. The column structure has not changed, so you do **not** need to reinitialize the database if it is already working. If you are upgrading an older spreadsheet that lacks `Registrations`, use the included `setupV29Upgrade` once.
4. In Apps Script go to **Deploy → Manage deployments → Edit → Version: New version → Deploy**. Confirm the deployed `/exec` URL.
5. Update the GitHub repository files from this ZIP, particularly `index.html`, `assets/js/app.js`, and `assets/css/style.css`. Keep `assets/js/api.js` pointing at your real Apps Script `/exec` URL. GitHub **Actions** should show a successful Pages deployment.
6. Hard-refresh the website and try adding two **test registrations**. Verify the top-right count eventually returns to zero and that both names appear in the Google Sheet's `Registrations` tab **exactly once**.

## Data safety and limitations

- **Automatic background sync is best-effort, not a guarantee of an immediate server save.** Entries marked Queued, Syncing, or Needs sync are **not yet confirmed by Google Sheets**. Keep the page/device available when possible until sync finishes.
- Queue recovery is device- and browser-specific. Clearing website data, using private browsing, changing browser/device, or limited storage can lose unsynced entries. The app refuses to queue new registrations when it cannot write the local queue.
- Pending registration names and notes are temporarily stored **unencrypted in browser site storage**. Avoid shared devices or clear data after everything is confirmed and you sign out; don't record sensitive data in Notes.
- Do not open two editing tabs in the same browser for registration. Two tabs may overwrite each other's browser-local outbox. Multiple devices can submit registrations normally, but the same person registered separately on multiple devices will remain two entries; only exact registration IDs are deduplicated.
- The backend validates the entire batch before writing it. A rejected batch stays marked Needs sync until corrected or resolved; don't interpret it as a confirmed save.
- Old v2.9.1 single-registration and non-registration actions continue working.
- Registration sheets, the existing group-password login, and other project features are unchanged.

## Files in this release

- `apps-script/Code.gs` — adds server-side `saveRegistrationsBatch` with multi-row writes and idempotent receipts.
- `assets/js/app.js` — local queue, debouncing, batch creation, background Sync, recovery and rapid-entry form.
- `index.html` — Add & Next / Save & Close controls, refreshed copy, cache-busted JavaScript paths.
- `assets/css/style.css` — queued, syncing, and failed indicators with mobile-friendly action buttons.

## Tested locally

- Google Apps Script simulation: batch insert, repeated same-ID saves, mixed editing, Family head counts, invalid-batch rejection, and registrar permissions.
- Browser simulation (using real frontend JavaScript and a mocked API): four rapid registrations combined into **one** batch write, saved counts confirmed; unsent registration restored after simulated browser restart; lost save confirmation retried with the **same request ID** without a duplicate.

Local simulated tests are **not** verification of the live Google Sheets deployment. Confirm against your actual spreadsheet before event day.
