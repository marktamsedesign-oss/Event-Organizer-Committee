# Pasko ng Angkan 2026 — v2.9.8

## Changes

1. **Finance summary:** the third Finance scorecard now displays **Receivables** (unpaid pledges and active registration contributions), rather than Collections. Existing ledger entries, payment history, and the FinanceRecords filters are unchanged.
2. **Instant edits / background saves:** form edits appear immediately after being safely written to a browser-local outbox. Saves run serially in the background using stable request IDs; confirmation and failure counts appear on the combined Sync/Refresh icon. Several rapid edits trigger one verified read after the burst rather than a read after each edit.
3. **Sync triggers:** (a) a saved change, (b) user clicks Sync/Refresh, (c) page loads/reloads, (d) **30 minutes after the most recent successful full sync**, while the app remains open. The timer resets after a successful manual/background refresh. No minute-by-minute idle polling.
4. **Mobile/network recovery:** hidden tabs defer scheduled reads until they become visible. A pending write takes priority over the timed refresh; failed writes retain their original request IDs for safe retry. A failed read leaves the previous confirmed view intact.

## Upgrade from v2.9.7

The functional change is **frontend-only**. Replace `assets/js/app.js` and `index.html` in your GitHub repository, commit and push, then verify the updated GitHub Pages deployment. `index.html` bumps the asset version to `v=2.9.8-sync` to avoid reusing the older cached frontend. Do not modify the existing `/exec` URL or run Google Apps Script `setupDatabase()` as part of this change. The complete project is also bundled for convenience.

**Do not overwrite `assets/js/api.js`** if your current deployed Apps Script URL differs from the one in the bundled example project. A patch ZIP is available to avoid replacing your current API configuration.

## When it contacts Google Sheets

| Event | Reads? | Writes? |
|---|---|---|
| Edit a committee/task/finance/food record | One verified read after pending writes complete | Yes, queued immediately |
| Rapid registration | One verified read after registration batches confirm | Yes, up to 20 per batch |
| Tap Sync/Refresh | Yes, or after queued edits confirm | Retry only pending/unconfirmed writes |
| Page load / reload | Yes | Restore and retry unsynced outbox if any |
| 30 minutes since last successful sync (app open) | Yes, once | Retry unsynced writes first |
| Inactive tab not yet due / idle below 30 min | No | No |
| Tab hidden when due | Postponed until visible | Existing writes aren't canceled |

**Important:** The thirty-minute scheduler works only while the site is open. Closing the browser/tab stops the scheduler; the next page load starts a fresh sync. Browser background throttling can defer the exact time.

## Test coverage

- `node --check assets/js/app.js` passed.
- `python tests/v298_sync_browser.test.py` passed (6 tabs, finance totals, receivables, payables release/undo, lost confirmation and filters).
- `python tests/v298_periodic_sync.test.py` passed (no early requests; 30-minute automatic fetch; manual timer reset; hidden-tab catch-up; pending write deferral; rapid changes and a single post-burst refresh).
- Local Node backend regression tests: finance, registration, payables, batch writes, schema setup: passed.

These tests used local mock data and simulated Apps Script responses, **not your production Google Spreadsheet**. Verify a test edit in a backup spreadsheet before broader rollout.
