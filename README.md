# Pasko ng Angkan 2026 — v2.6

Mobile-friendly GitHub Pages frontend plus Google Apps Script/Google Sheets backend for managing Christmas event committees, people, tasks, receivables, expenses, and food supplies.

**Start with [RELEASE-v2.6.md](RELEASE-v2.6.md)** for the feature list, safe upgrade sequence, and acceptance checks. Historical releases [v2.5](RELEASE-v2.5.md), [v2.4](RELEASE-v2.4.md), [v2.3](RELEASE-v2.3.md) and [v2.2](RELEASE-v2.2.md) remain for reference only.

## Features

- Login using a shared group password (set `GROUP_PASSWORD` in Apps Script project Script properties; do not commit your real password to GitHub).
- Directors can add users, edit committees, assign/replace committee Heads and Support members, and archive/restore committees without deleting the underlying records.
- Committee Heads can edit their committee's tasks and Support roles. Committee members can mark their committee tasks **Complete**, with completion name and date visible in task details.
- Each committee card has a **Go to tasks** icon that filters the To-do list to just that committee.
- Committee progress is **completed task count / total task count**, not a separately editable per-task percentage.
- Finance tracker separates Cash on Hand, Receivables, and Expenses. Historical Income records are preserved. Food tracker includes assigned supplies and Todo/Done status.
- Upper-left menu offers **My tasks / committees**, a **People & roles summary** sorted by Name A–Z or Z–A (with copyable role lists), plus **Simplified** and **Detailed** group-chat copying modes for all committees.
- Upper-right **Sync & Refresh** combines background write retry and new-data reads, with a numbered badge for unsynced edits.
- Last-confirmed in-tab state stays visible while a page load or refresh requests the latest Google Sheets data.
- Icon-only controls have descriptive hover text and accessibility labels. On mobile, Save/Cancel floats above the keyboard when supported.
- **Go to tasks → Add task** preselects that committee; new Support-member assignment always starts with a blank person selector. Common accidental zoom gestures are blocked where browsers allow.

## Repository layout

- `index.html` — single-page interface
- `assets/js/app.js` — interactive UI and save/sync behavior
- `assets/js/api.js` — Google Apps Script endpoint (`API_URL` must match your live `/exec` URL)
- `assets/css/style.css` — responsive styling
- `apps-script/Code.gs` — server, permissions, data operations and audit records
- `apps-script/README-SETUP.md` — backend checklist
- `.github/workflows/pages.yml` — GitHub Pages deployment

## Deployment

Back up your spreadsheet and repository. **If you already deployed the working v2.4 backend**, no Apps Script change or spreadsheet migration is required: replace the GitHub frontend files and publish. If you are upgrading from an older version, follow the backend upgrade directions in [RELEASE-v2.4.md](RELEASE-v2.4.md) first. Confirm the `/exec` URL in `assets/js/api.js`. See [RELEASE-v2.6.md](RELEASE-v2.6.md) for instructions.

**Data and security:** The shared group password is a convenience mechanism, not strong user authentication. Do not store sensitive personal or account data. Keep the live Google Sheet private; do not upload backups or exported records to the public GitHub repository.
