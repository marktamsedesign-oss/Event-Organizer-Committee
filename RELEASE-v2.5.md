# Pasko ng Angkan 2026 — v2.5 update

This release builds on v2.4 and **only changes the GitHub Pages frontend** (index.html, assets/js/app.js, assets/css/style.css). The `apps-script/Code.gs` file is carried forward unchanged. No spreadsheet migration or Apps Script redeployment is needed if you already have the working v2.4 backend.

## Five improvements

1. **Mobile editor actions near the keyboard.** The edit form shows two icon-only buttons: **Cancel (X)** and **Save (floppy disk)**. On screens up to 700 px wide, this button bar floats above the on-screen keyboard when the browser reports its height. It remains available during scrolling. Buttons have tooltips and accessible names. Browser keyboards vary, so verify on your actual phone; some older browsers do not report keyboard dimensions.
2. **Go to tasks → Add task defaults to that committee.** When a user opens a committee's tasks, the To-do list filter is set to that committee. Pressing the `+` Add task button now picks that same committee. It also honors a manually selected committee filter. The user must still have create-task permission for that committee; otherwise a committee they manage is selected.
3. **New committee Support member starts blank.** When creating a membership from the committee manager or upper-right Add menu, the Person dropdown starts at **Choose a person…**, and saving without a choice is blocked by the required select. Existing assignments still preselect their current person for editing/replacement.

4. **My tasks / committees from upper-left menu.** After signing in, open the hamburger menu → **My tasks / committees** to see your committee roles, responsibilities, committee completion, and only tasks directly assigned to your user. Each committee has a Go to tasks icon; individual assigned tasks have an Open task icon that selects their committee and task. The view updates from the existing app data when Google Sheets syncs; no new backend action or spreadsheet column is required. If you belong to a committee but have no direct tasks, you can still open all of its tasks.

5. **Simplified and Detailed group-chat copy tabs.** Hamburger menu → Copy all committees for group chat opens **Simplified** by default: lists every active committee, its Heads, support members with their roles, overall progress, and up to two outstanding task titles. Switch to **Detailed** for the original comprehensive report: committee responsibilities, all Heads/support roles, each task with assignments, due dates, priority, and completion history. Each tab updates the preview; **Copy report** copies the selected format for Messenger, Viber, or WhatsApp. Nothing is sent automatically. If changes remain unsynced, both reports warn that local edits may not yet be confirmed in Sheets. The "support" group denotes assigned Support roles, not a separate hierarchical subcommittee database.

## How to update

1. Back up your current GitHub repository and Google Spreadsheet.
2. Unzip this package, then upload the contents of `Event-Organizer-Committee-main` to your existing repository **root**, keeping the `assets/` structure (do not upload the ZIP itself).
3. Commit/push changes, check that GitHub Pages deploys, and refresh your page. Assets now use `?v=2.5` so the browser requests the new files.
4. There is **no Apps Script backend change** in this release. Only deploy `Code.gs` if your live backend is older than v2.4.

## Test cases

- Open any edit form on Android/iPhone and tap a text field. The Save/Cancel icons should remain visible above the soft keyboard, not covering your typed text.
- Committee card → Go to tasks → Add task. The committee dropdown should display the committee you came from.
- Committee → Manage members → Add Support. The Person dropdown should show Choose a person… until a name is explicitly selected. The top-right Add → Assign committee member follows the same rule.
- Editing an existing member still shows their current name, and replacing them updates the existing assignment rather than adding another one.
- Upper-left hamburger menu → My tasks / committees shows only the logged-in user’s active committee memberships and directly assigned tasks, with status and role details. Test switching users and check the view changes.
- Select Go to tasks or Open task in My tasks / committees; the modal closes and To-do list filters to the relevant committee/task.
- Upper-left menu → Copy all committees → Simplified and Detailed. Verify text differences, switch tabs, copy each selection, paste into a chat draft, and confirm no message is sent automatically.
- If new Sheets edits sync while Share is open, the active report preview updates and the selected tab remains selected.

## Existing functionality retained

- Shared group password, committee archive/restore, upper-right Add menu, background saves and Sync/Refresh, Receivables, task completion attribution, and readable copy-all committee report.
