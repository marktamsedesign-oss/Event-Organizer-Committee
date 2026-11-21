# Upgrade guide — Pasko ng Angkan 2026 v2.4

For the current, fully updated installation checklist, see **RELEASE-v2.4.md**. This replaces older steps mentioning progress percentage editing, separate Refresh/Sync buttons, or `Income` as an ordinary entry type.

## Before you deploy

1. Make a copy of the live Google Spreadsheet and download a backup of the existing GitHub repository.
2. In Google Apps Script, replace **Code.gs** with `apps-script/Code.gs` in the ZIP. Save it, then deploy **Manage deployments → Edit → New version**. A v2.3 sheet needs **no new columns** for v2.4; task completion attribution is read from `TaskUpdates`.
3. Make sure your actual group password is in Apps Script **Project Settings → Script properties** under `GROUP_PASSWORD`. Do not publish it in GitHub.
4. Unzip the GitHub bundle and copy the **contents** of `Event-Organizer-Committee-main` to your repository root. Do not create a nested second folder. Confirm `assets/js/api.js` has the correct Apps Script `/exec` URL.
5. Commit/push changes, check GitHub Actions and open the website. Hard-refresh once to load the newly versioned assets.
6. Sign in, click the committee card's checklist icon, complete one test task, check its completion date/name, check group-chat copy, and test top-right Sync & Refresh.

## Historical PIN migrations

If the `Users` sheet still has a `pinHash` column, run `migrateRemovePinColumn` from the Apps Script editor **before** `setupDatabase`; the migration checks column order and preserves user rows. If your v2.3 app was working, the migration has already been completed and should not be needed again.

## Behavior

- The app shows the last confirmed view while it checks fresh data from Apps Script. Browser-tab caching is not an online backup and is cleared when signing out.
- Task cards offer Edit and Complete actions as permitted by role. Committee percentage progress uses **completed tasks ÷ all tasks**, regardless of their past individual progress values.
- Task completion attribution depends on existing audit records; entries completed manually without an audit event cannot be attributed reliably.
- The upper-left report includes committee purpose, Head(s), Support/sub-team role and task breakdowns. If your organization uses formally nested subcommittees, those require an additional data model not present in this release.
- Pending changes must be confirmed in the online app before closing the tab. The shared-password model is not suitable for sensitive information.
