# Pasko ng Angkan 2026 — Release v2.3

## Changes since v2.2

1. **Finance: Receivables replaces Income.** The entry form now offers Cash on Hand, Receivables, and Expense. Receivables are *not* included in the Available cash total (Cash on Hand - Expenses). Historical Income rows are preserved, displayed as `Income (legacy)`, and excluded from current summaries until manually reviewed/updated. **No finance data is automatically rewritten.** When a receivable is collected, reduce/update the outstanding receivable and record the cash received as Cash on Hand; make sure to avoid duplicate cash amounts.
2. **Icon-first actions.** Add/Edit/Delete/Manage/Refresh/Sync/Restore/Update buttons show SVG icons with hover tooltips and screen-reader descriptions. Navigation tabs remain labeled to aid recognition.
3. **Standalone Delete buttons.** Destructive buttons have their own separated area, remain role-restricted, and still require confirmation. Committee deletion still archives, preserving its records.
4. **Upper-right toolbar.** Refresh gets the latest sheet records. Sync has an unsynced-count badge (pending + failed edits). Edits still save automatically in the background, but failed/unconfirmed jobs remain visible for manual retry. A manual retry reuses the *same request ID*.
5. **Upper-right Add menu.** Add user (Directors/Assistant Directors only) and Assign member (Directors and eligible Committee Heads, assigned only to their committees). Existing member replacement continues to modify the same assignment ID.
6. **Backend write deduplication.** A `WriteReceipts` sheet is created automatically to remember confirmed write request IDs so retried requests do not repeat changes.

## Deploy safely

1. Make a backup of the Google Spreadsheet and GitHub repository (including historic FinanceEntries).
2. Extract this ZIP and replace corresponding GitHub frontend files; add `apps-script/Code.gs`.
3. In the spreadsheet-bound Apps Script editor, paste the new `apps-script/Code.gs`.
4. If still migrating from the old PIN version, run `migrateRemovePinColumn()` before database setup; otherwise skip this migration.
5. Run `setupDatabase()` (it will add the `WriteReceipts` sheet; existing matching sheets/data are preserved).
6. Deploy > Manage deployments > Edit > New version > Deploy. Keep your /exec URL in `assets/js/api.js` in sync with the active web app.
7. Commit/push the frontend to the same GitHub Pages branch; verify the Pages workflow succeeded; hard refresh the browser.
8. Sign in as a Director and verify the upper-right **+** menu and Sync indicator. Test adding a sample receivable and a committee member.

**Warning:** Loading the new frontend before the new v2.3 Apps Script backend will show an API version mismatch. Frontend errors will not silently fall back to older schemas.

**Synchronization:** queued edits update the local UI immediately; confirmation can take longer if Sheets is busy. Do not close/reload with a nonzero sync badge. An error is retained for manual retry using Sync. If you click Refresh while errors remain, the UI will explicitly ask whether to discard those unsaved local edits. A browser crash before confirmation may still lose local uncommitted edits.

**Security:** This system retains its earlier shared-password protection. It is intended for event coordination, not confidential financial or personal information. Do not publish real passwords or sensitive records in the GitHub repository.
