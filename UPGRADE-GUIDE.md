# Upgrade Guide — Pasko ng Angkan 2026 v2.1

This ZIP contains the **updated frontend AND matching backend**. The old GitHub frontend sent `pin`; v2.1 sends `password` and requires a v2 backend. **Do not upload the ZIP as a single file into GitHub**; unzip it and replace the individual repository files.

## 1. Back up your spreadsheet and existing files

- In the Google Sheet that stores your event records: **File → Make a copy**. Keep the copy as your rollback backup.
- Download a backup of your existing GitHub repository, too.
- Make sure you are editing the **Apps Script project bound to the same spreadsheet** that stores the event data.

## 2. Update and migrate Google Apps Script FIRST

1. Open your bound Apps Script editor from the event database spreadsheet (**Extensions → Apps Script**).
2. Open its `Code.gs` and replace its contents with **`apps-script/Code.gs`** from this ZIP. Click **Save**.
3. If the old `Users` sheet has a `pinHash` header, use the function selector at the top of the Apps Script editor to run **`migrateRemovePinColumn`** **before** `setupDatabase`.
4. Inspect the `Users` sheet header. It should be exactly: `id, name, position, accessRole, active, createdAt` (columns A–F).
5. Run **`setupDatabase`** using the function dropdown. It only seeds an empty table; it does **not** delete existing users or tasks. The schema check now throws an error instead of clearing mismatched tables. If you see a header mismatch, stop and check the sheet headers against the error before changing data.
6. Go to **Project Settings → Script properties**. Set key `GROUP_PASSWORD` to the shared password you choose. If it is not set, the fallback is `LAMI`, as requested; change it before real-world use.
7. Go to **Deploy → Manage deployments → Edit** (pencil) → select **New version** → **Deploy**. Configure **Execute as: Me** and **Who has access: Anyone** as appropriate for the GitHub Pages frontend. Copy the deployed **`/exec`** URL. Be aware that public web-app access plus a shared password is not suitable for sensitive data.
8. If you created a completely **new** web-app deployment instead of editing the existing one, its `/exec` URL may change.

### Why the migration originally failed

The old helper ran `ensureSchema_()` *before* removing `pinHash`. The schema rejected the old `Users` header immediately. The corrected helper checks the headers without calling `ensureSchema_()` first and only deletes `pinHash` if the other headers match; it preserves all rows.

## 3. Update the GitHub frontend

1. Unzip this package locally.
2. Replace the files in the **root of your GitHub repository**. `index.html` must be in the repository root, **not** inside another `Event-Organizer-Committee-main` folder.
3. Open `assets/js/api.js`. Set `API_URL` to the Apps Script **`/exec`** URL you confirmed in step 2. This package keeps the existing repository URL as a starting point; check whether it points to the updated deployment.
4. Commit and push all replaced files. In VS Code, after copying the files into your checked-out repo:

   ```bash
   git status
   git add .
   git commit -m "Upgrade Pasko ng Angkan to v2.1"
   git push origin main
   ```

   Replace `main` if your deploy branch differs.

5. In GitHub **Actions**, verify that **Deploy GitHub Pages** succeeded. Make sure GitHub Pages is configured to use **GitHub Actions** as its build source if using the included workflow.
6. Open your public site and hard-refresh it (Ctrl/Cmd+Shift+R). The HTML loads version-tagged CSS/JS files to reduce stale browser caching.

## 4. Quick acceptance tests

- **Login:** Name selector previews committee roles. The field says **Group password** and accepts the shared group password. It must no longer show Personal PIN. Welcome toast displays committee count. If the website reports that Apps Script isn't v2, the backend deployment or API URL is still old.
- **Director:** Open a committee → **Manage members** → add multiple Heads and Support members; edit existing assignments; remove a member using confirmation.
- **Committee Head:** Sign in as a Head; you can add Support people and create/edit tasks for your committees only. You cannot promote or remove Heads.
- **Task assignment:** Select multiple assignee chips without Ctrl/Command, then save with **Also add assignees...** checked. Confirm that newly assigned users appear as committee Support members.
- **Finance:** As Finance Head / Director, add Cash on Hand, Income, Expense and check the calculated balance. Edit an entry. Only a Director or original recorder can delete a finance entry.
- **Food:** As Food Head / Director, add Food / Drink / Other items, specify quantities and assignees, toggle Todo/Done, edit and delete with confirmation.
- **Reports:** CSV export still works; task progress/history can still be accessed according to committee permissions.

## 5. Troubleshooting

| Problem | Likely cause | Solution |
| --- | --- | --- |
| Still asks for PIN | Old frontend is still published / browser cache | Ensure `index.html` and `assets/js/app.js` were replaced, the GitHub Actions deploy succeeded, and hard-refresh |
| “Apps Script deployment is not v2” | `api.js` points to old deployment | Copy updated `Code.gs` into the bound Apps Script project; deploy **New version**; verify `/exec` URL |
| “Unexpected headers in sheet Users” | Old `pinHash` column still exists / headers changed | Back up sheet; run `migrateRemovePinColumn` before `setupDatabase`; inspect row 1 if it still fails |
| Saved finance/food records don't show | Apps Script deployment isn't updated or sheets not set up | Check deployment and run `setupDatabase`; verify `FinanceEntries` / `FoodItems` header rows |
| Site loads but requests time out | Wrong `/exec` URL or access settings | Confirm deployment URL, access permissions and your internet connection |
| GitHub changes don't appear | ZIP uploaded as an attachment instead of files / Actions not run | Unzip into repository root, commit individual files, inspect Actions and hard-refresh |

**Important:** This package was checked locally for syntax and internal UI/backend compatibility. It was **not** deployed to your private Google Spreadsheet or GitHub account; you must carry out the two deployment steps above.
