# Pasko ng Angkan 2026 — v2.6

## New upper-left menu: People & roles summary

The menu now offers **People & roles summary** in addition to **My tasks / committees** and the Simplified/Detailed committee sharing views. It shows each active person and their:

- Name, listed position, and app access role.
- **Head** assignments across all active committees, plus recorded responsibility text.
- **Support** assignments across all active committees, plus recorded responsibility text.
- A clear **No assignments** message if no committee membership exists.

The new dialog supports **Sort by name → Name A–Z (default)** or **Name Z–A**, case-insensitive, including names with numbers. It also includes a search for names, committee titles, system roles, positions, and support responsibilities. **Copy summary** generates a group-chat friendly text report using the *visible*, sorted/filtered results. Copy does not send any messages.

Data is derived from the existing user and committee-member records already loaded by the app, so no extra backend calls or spreadsheet columns are required. Results update automatically after successful background sync or refresh. Inactive people, inactive assignments, and archived committees are excluded. The app includes all active users, even those with no assigned committee.

## Upgrade from v2.5

1. Back up your working repository and Sheet.
2. Extract this ZIP and upload/replace **`index.html`**, **`assets/js/app.js`**, **`assets/css/style.css`** in GitHub. The other files are included for completeness and are unchanged except documentation.
3. Confirm `assets/js/api.js` still points to your correct deployed Apps Script `/exec` URL. Do not replace a working live endpoint accidentally.
4. Commit/push GitHub and check Pages deployment. Hard refresh the browser once.
5. Sign in, open the upper-left menu → **People & roles summary**. Verify alphabetical A–Z and Z–A sorting, search, no duplicate memberships and both Head/Support sections. Copy a draft to your group chat to check formatting.

**No Apps Script redeployment is required when upgrading from a working v2.5 setup.** This release changes only the frontend.

## Privacy and data integrity

Use the Copy action only for groups where it is appropriate to share the membership directory; no data is transmitted by this action beyond your clipboard. The existing shared group password is not a substitute for strong authorization. Keep the backing Google Sheet and backups private.
