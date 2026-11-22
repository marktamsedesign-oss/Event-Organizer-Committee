# v2.9.4 tested directory fix

## Root cause reproduced in v2.9.3
`getData_()` in the v2.9.3 `Code.gs` maps active users through `sessionUser_()`, which omits their `active` property. The old frontend used `.filter(u => active(u.active))`, turning 22 real users into 0 visible users. The old frontend was run in a headless Chromium browser with an exact mock of this backend user shape; it produced the same **0 of 0 people / No matching people** failure.

## Regression tests on updated frontend
1. `getData` succeeds with all 22 users **missing** `active`: shows 22/22, support/head roles and assigned task completion.
2. `bootstrap` succeeds but the slower nine-sheet `getData` fails: shows 22 people and their roles without waiting for tasks.
3. Legacy `apiVersion 29` bootstrap without directory contract: shows 22 people; does not falsely claim full data is verified.
4. Cached directory with backend offline: displays the previously confirmed 22 people.
5. Bootstrap with mismatched user counts: keeps previous confirmed directory.
6. Bad bootstrap without cache: shows an explicit error and a Retry control; retry recovers 22 people.
7. Searching and Z–A sorting remain correct.
8. Changes to Support memberships appear after a directory refresh.
9. Registration batch API capability remains available after bootstrap. (Assessed as part of test 1.)

All browser scenarios passed on Chromium in a mobile-sized viewport. `node --check` passed. Unchanged v2.9.3 mocked-Google-Sheets backend and v2.9.2 batch-compatibility unit tests passed.

## Limits
These tests use real frontend code with simulated Apps Script responses; they do **not** connect to your live Google Sheet. If the deployed web app URL is wrong or Apps Script cannot return *any* directory response, this frontend fix will show the error/retry state rather than invent data. The patch does not alter Google Sheets records or backend functions.
