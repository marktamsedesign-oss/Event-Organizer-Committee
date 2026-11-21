# Pasko ng Angkan 2026 — v2.4

Mobile-friendly GitHub Pages frontend plus Google Apps Script/Google Sheets backend for managing Christmas event committees, people, tasks, receivables, expenses, and food supplies.

**Start with [RELEASE-v2.4.md](RELEASE-v2.4.md)** for the feature list, safe upgrade sequence, and acceptance checks. Historical releases [v2.3](RELEASE-v2.3.md) and [v2.2](RELEASE-v2.2.md) remain for reference only.

## Features

- Login using a shared group password (set `GROUP_PASSWORD` in Apps Script project Script properties; do not commit your real password to GitHub).
- Directors can add users, edit committees, assign/replace committee Heads and Support members, and archive/restore committees without deleting the underlying records.
- Committee Heads can edit their committee's tasks and Support roles. Committee members can mark their committee tasks **Complete**, with completion name and date visible in task details.
- Each committee card has a **Go to tasks** icon that filters the To-do list to just that committee.
- Committee progress is **completed task count / total task count**, not a separately editable per-task percentage.
- Finance tracker separates Cash on Hand, Receivables, and Expenses. Historical Income records are preserved. Food tracker includes assigned supplies and Todo/Done status.
- Upper-left menu creates a copyable plain-text report of all committees, Heads, Support/sub-team responsibilities, and tasks for group chats.
- Upper-right **Sync & Refresh** combines background write retry and new-data reads, with a numbered badge for unsynced edits.
- Last-confirmed in-tab state stays visible while a page load or refresh requests the latest Google Sheets data.
- Icon-only controls have descriptive hover text and accessibility labels. Common accidental zoom gestures are blocked where browsers allow.

## Repository layout

- `index.html` — single-page interface
- `assets/js/app.js` — interactive UI and save/sync behavior
- `assets/js/api.js` — Google Apps Script endpoint (`API_URL` must match your live `/exec` URL)
- `assets/css/style.css` — responsive styling
- `apps-script/Code.gs` — server, permissions, data operations and audit records
- `apps-script/README-SETUP.md` — backend checklist
- `.github/workflows/pages.yml` — GitHub Pages deployment

## Deployment

Back up your spreadsheet and repository. Paste the package's `apps-script/Code.gs` into the *spreadsheet-bound* Apps Script editor, deploy a **New version**, and publish the frontend to GitHub Pages. Match the `/exec` URL in `assets/js/api.js`. Previous installations already on v2.3 need **no schema change** for the new task completion history; old `pinHash` migrations remain available if required. See [RELEASE-v2.4.md](RELEASE-v2.4.md) for full instructions.

**Data and security:** The shared group password is a convenience mechanism, not strong user authentication. Do not store sensitive personal or account data. Keep the live Google Sheet private; do not upload backups or exported records to the public GitHub repository.
