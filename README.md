# Pasko ng Angkan 2026 — v2.1

Mobile-friendly event committee and task management for **December 13, 2026**, backed by Google Sheets and Google Apps Script, with a static frontend for GitHub Pages.

## What changed in v2.1

1. **Shared group password:** replaces per-user PINs. Name selector previews the user's committee membership and support roles before sign-in. A welcome message shows the committee count. Set the password in Apps Script **Project Settings → Script properties → `GROUP_PASSWORD`**. The code defaults to `LAMI` only if no property is set; change it before sharing your event website.
2. **Manage committee membership:** Director / Assistant Director can add and edit committees; assign, change and remove multiple committee Heads and Support members. Heads can add/edit/remove Support assignments for their committee but cannot change Heads.
3. **Committee-head task permissions:** Heads can create and edit tasks within their committee. Only Directors can move tasks between committees. Members can update status/progress for their committees. Task assignees are now tap-to-toggle chips; the task form defaults to also enrolling newly assigned people as Support members.
4. **Finance and Food:** Finance includes Cash on Hand, Income and Expense and a calculated available balance. Food includes Food, Drink and Other, quantity, remarks, assignee, Todo/Done and inline toggles. Only relevant committee Heads and Directors may edit those modules. Finance deletion is limited to the original recorder or a Director.
5. **UI improvement:** role-specific actions, responsive layout, member and login preview, safer confirm dialog, and explicit error when the frontend is connected to an old backend deployment.

## Setup

**Read `UPGRADE-GUIDE.md` before replacing files.** It covers the one-time database migration, Google Apps Script deployment and GitHub Pages publication. The frontend and backend must be updated **together**.

Key files:

- `index.html` — main UI, including Finance and Food tabs
- `assets/css/style.css` — responsive styling
- `assets/js/api.js` — API bridge; verify `API_URL` is the correct Apps Script `/exec` URL
- `assets/js/app.js` — interactive frontend
- `apps-script/Code.gs` — v2.1 backend; paste into your **spreadsheet-bound** Apps Script project
- `apps-script/README-SETUP.md` — backend setup notes
- `.github/workflows/pages.yml` — deployment via GitHub Actions from `main`

## Permissions

| Role | Manage committee details | Assign Heads | Assign Support | Create/edit committee tasks | Update task progress | Finance | Food |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Director / Assistant Director | Any | Any | Any | Any | Any | Edit | Edit |
| Committee Head | — | — | Own committee | Own committee | Own committee | Edit if COM-FIN Head | Edit if COM-FOOD Head |
| Committee Support member | — | — | — | — | Own committee | View | View |

All signed-in users can see task summaries, Finance and Food data. The shared password is convenience-level protection, **not strong individual authentication**. Do not store sensitive personal or banking data in this app.

## Notes

- Finance calculation: **balance = sum(Cash on Hand) + sum(Income) − sum(Expense)**. Cash on Hand entries are additive; avoid re-entering the same cash balance.
- App passwords are not stored in `localStorage`; session tokens are stored locally until sign-out or expiration. Sessions expire after ~6 hours.
- Updating GitHub files does **not** automatically update the Apps Script deployment. Both deployment steps are required.
- Existing data sheets are never silently cleared to resolve a header mismatch. Back up your Google Spreadsheet first, then migrate your old `Users.pinHash` column using the function provided.
