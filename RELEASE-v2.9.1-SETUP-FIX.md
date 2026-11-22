# v2.9.1 — Database setup runtime fix

## Why setupDatabase appeared to run forever

- The old function ended with `SpreadsheetApp.getUi().alert(...)`, which can block waiting for a spreadsheet UI dialog or fail without access to the UI.
- Initial installation used many individual `appendRow()` calls, which add avoidable spreadsheet service overhead.
- The setup function rechecked every database sheet even when you only needed the new v2.9 tables.

## Recommended: upgrading an already populated spreadsheet

1. Back up your spreadsheet with **File → Make a copy**.
2. Open the Apps Script **bound to that spreadsheet** (Extensions → Apps Script).
3. Replace the existing `Code.gs` with `apps-script/Code.gs` from this package and **Save**.
4. In the function dropdown choose **`setupV29Upgrade`** (not `setupDatabase`) and click **Run**.
5. Check **Executions** or **Execution log**. Success shows three sheets either created or already ready:
   `WriteReceipts`, `PersistentSessions`, `Registrations`.
6. If an error occurs, copy the **exact error message and line number**. Do not delete database tabs or run repeated setup attempts before diagnosing it.
7. Deploy → Manage deployments → Edit → **New version** → Deploy to publish the patched backend. No frontend change is required.

`setupV29Upgrade` does not seed Users, Committees, CommitteeMembers, or Tasks and does not erase any rows. If the sheet has a header mismatch, it stops and reports the offending headers.

## For brand new EMPTY spreadsheets only

Run `setupDatabase`. It now seeds each database sheet using one batch write instead of individual row appends. It logs the result instead of opening an alert. **Do not use this to recover missing records in a partially initialized database.**

## Troubleshooting

- `No active spreadsheet`: Open the script via your Google Sheet's **Extensions → Apps Script**, not a standalone script project.
- `Unexpected headers`: Existing column headers differ from the expected schema. Back up and inspect, never delete the sheet automatically.
- `Exceeded maximum execution time`: Inspect **Executions** to identify which operation exceeded the limit. `setupV29Upgrade` is a minimal migration designed to avoid the bulk seeding path.
- `You do not have permission`: Authorize access and ensure you own/have edit access to the correct spreadsheet.
- Completed but website unchanged: Save and redeploy the Apps Script web app using a **New version**.

**Privacy:** Keep participant data in the Google Sheet; do not commit spreadsheet exports or user data to GitHub. This ZIP contains code only.
