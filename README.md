# Pasko ng Angkan 2026

Mobile-first committee and task management web app.

**Event date:** December 13, 2026  
**Director:** Mark Tamse  
**Assistant Director:** Jezreel Von Jawili

## Features
- Committee directory, heads and support roles
- Committee task list, status and progress updates
- Director's report dashboard and pending/blocked task flags
- Name + PIN sign-in
- Committee-level task update permissions
- Task update history and activity log
- CSV report export
- Google Sheets database through Google Apps Script
- GitHub Pages frontend hosting

## Quick start
1. Set up and deploy the Google Apps Script backend using `apps-script/README-SETUP.md`.
2. Copy the deployed `/exec` URL.
3. Open `assets/js/api.js` and replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with the URL.
4. Commit and push the project to GitHub.
5. Enable GitHub Pages for the repository (Settings → Pages → Deploy from a branch → `main` → `/ (root)`).
6. Open the GitHub Pages URL and sign in.

## Security
The backend uses hashed PINs, expiring sessions, and committee membership checks. This is a lightweight event tool, not high-assurance identity verification. Anyone with the link can access public event data. Never place private contact details in the public-facing data.

## Project layout
- `index.html` — app shell
- `assets/css/style.css` — responsive styling
- `assets/js/api.js` — Apps Script API bridge
- `assets/js/app.js` — UI and application logic
- `apps-script/Code.gs` — backend and database setup
- `apps-script/README-SETUP.md` — Apps Script deployment instructions

## Current scope
The notification/message UI is reserved for a future iteration. The `Notifications` sheet is initialized for later @mentions and task call-outs. User administration (creating accounts and changing PINs) is currently done by the spreadsheet owner through Apps Script.
