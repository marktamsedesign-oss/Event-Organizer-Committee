# Pasko ng Angkan 2026 — v2.9.7 Finance dashboard card order

## What changed
Only the five scorecards above the main tabs when **Finance** is selected have changed order and mobile/desktop grid placement.

**Top row (two large cards):** Total Funds | Cash Available

**Second row (three cards):** Collections | Expenses | Payables

- `Collection` was relabeled `Collections` for consistency with the requested layout.
- The underlying amounts, equations, transaction records, Payables release rules, registration receivables, and other tab scorecards are **unchanged**.
- Cash Available retains its blue-highlighted appearance.
- This is a **frontend-only** update. No migration, `setupDatabase()`, or Apps Script deployment is needed when already running v2.9.6.

## Upgrade
1. Back up the current GitHub project.
2. Replace exactly `assets/js/app.js` and `assets/css/style.css` using the patch ZIP, preserving their directories.
3. Commit/push to the GitHub Pages deployment branch; check Actions and refresh the site after deployment.
4. Open Finance and verify the five labels appear in the exact order shown above. Use the amounts from your own spreadsheet rather than the local demo amounts.

If your installed version is older than v2.9.6, install the complete v2.9.7 ZIP and follow the v2.9.6 backend instructions first.

## Tests
- JavaScript parser (`node --check`): passed.
- Chromium frontend with a simulated Google Apps Script response at 360 px, 430 px, and desktop: passed.
- Finance summary order and two-row geometry: passed.
- All six contextual dashboard tabs and finance filters: passed.
- Release Payment, reversal, sync retry, no duplicate payout: passed.
- Node backend regression for Payables: passed.

*Local tests only; no live Google Sheets or GitHub files were changed.*
