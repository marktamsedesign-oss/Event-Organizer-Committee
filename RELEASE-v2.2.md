# Pasko ng Angkan 2026 — v2.2 release notes

This package includes the **complete updated GitHub Pages frontend and matching Google Apps Script backend**.

## Fixes and additions

- Confirmed **Delete committee** action for Directors / Assistant Directors; records are archived (active=false) and can be restored from the top-right profile menu. All task/member rows are retained.
- **Add new user** in the top-right profile menu for Directors / Assistant Directors; creates a standard active member profile and rejects duplicate names.
- **Faster editing with background Google Sheets sync:** optimistic UI updates, serialized writes, save status badge, recovery after errors, warning on closing a page while saving, and periodic refresh.
- **Committee progress** is calculated automatically from the proportion of tasks with status `Completed`. Example: 3 Completed out of 5 total = 60%. Individual task percentage is separate.
- **Committee member replacement bug fixed:** an edited assignment is updated by `CommitteeMembers.id` instead of being matched by the newly selected `userId`. Replacing a member does not insert a second row. Duplicate assignments are rejected.
- **Quick task completion** button to change a task to `Completed` (100%) in one action.

## Deployment sequence

1. **Back up Google Sheets and the current GitHub repository.**
2. Replace the spreadsheet-bound Apps Script `Code.gs` with `apps-script/Code.gs` from the package. Save it. If migrating from the old PIN version, run `migrateRemovePinColumn` first; run `setupDatabase` as needed.
3. Apps Script: **Deploy → Manage deployments → Edit → New version → Deploy**. Confirm web-app access and the resulting `/exec` URL.
4. Confirm that `assets/js/api.js` points to that `/exec` URL. **Do not put the real group password in GitHub.** Configure `GROUP_PASSWORD` in Apps Script Project Settings → Script properties.
5. Copy the updated frontend files and folders into the **root** of the GitHub repository, commit/push them, verify GitHub Actions Pages deployment, and hard-refresh the website.
6. The frontend requires a backend reporting `apiVersion: 22`. Older deployments intentionally show an error rather than risking incompatible writes.

**Important:** The background save works only while the website tab is running and connected. Wait for **All changes saved** before closing the tab. A failed write is not automatically retried; check Google Sheets and refresh before re-submitting to avoid duplicate records. The group password is shared protection and is not appropriate for sensitive personal or financial data.

For the detailed rollout checklist and troubleshooting, see `UPGRADE-GUIDE.md`.
