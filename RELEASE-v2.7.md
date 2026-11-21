# Pasko ng Angkan 2026 — v2.7 (Compact sort control)

## What changed

In **upper-left menu → People & roles summary**, the large **Sort by name** dropdown has been replaced by a small icon button **directly to the right of Search**. This keeps the search field wide, especially on phones.

- The icon initially displays **Name A–Z** sorting.
- Tap/click the icon to switch to **Name Z–A**, and tap again to return to A–Z.
- The icon updates to show direction, and the hover tooltip / screen-reader label explains the current sort and next action.
- Sorting continues to work alongside search, and **Copy summary** respects the chosen order and current search results.
- The rest of v2.6, including committee management, My Tasks, background sync, and group-chat sharing, remains unchanged.

## Upgrade from v2.6

1. Back up your GitHub repository first.
2. Replace `index.html`, `assets/js/app.js`, and `assets/css/style.css` with the files from this ZIP.
3. Commit/push these frontend files to the branch used by GitHub Pages. Verify the deployment in GitHub Actions.
4. Refresh the website once. The asset links use `?v=2.7` to help avoid stale browser assets.
5. Open **☰ → People & roles summary**. Search for a name, press the sort icon, verify the order reverses, and test Copy summary.

**No Google Apps Script changes or new spreadsheet columns are needed** when upgrading from a working v2.6 deployment. The included `apps-script/Code.gs` is unchanged; keep your currently deployed backend.
