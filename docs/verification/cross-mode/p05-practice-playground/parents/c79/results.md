# Executed results

All commands and their full argv/cwd, timeouts, exit codes, input hashes and log hashes are in each run receipt. Commands were sequential under the owner's bounded allocation.

| Run | Scope | Result |
| --- | --- | --- |
| [proposal20-01](runs/proposal20-01/receipt.json) | First complete11file Node20 cohort |128reported:121pass,7fixture TypeErrors; no production failure claim; retained |
| [proposal20-02](runs/proposal20-02/receipt.json) | Corrected complete11file Node20 cohort |128pass:127leaves+1parent; no fail/skip/cancel |
| [proposal22-01](runs/proposal22-01/receipt.json) | Same final inputs, complete11file Node22 cohort |128pass:127leaves+1parent; no fail/skip/cancel |
| [baseline20-01](runs/baseline20-01/receipt.json) | Qualified-parent app plus final23case host test on Node20 |18pass,5ERR_ASSERTION failures at real defect checks |
| [baseline22-01](runs/baseline22-01/receipt.json) | Identical behavioral baseline on Node22 |Same18pass and5ERR_ASSERTION failures |
| [final format/syntax](runs/final-format-syntax/receipt.json) | Final two changed files |One Prettier check and two Node20 syntax checks pass |

Candidate command shape: exact versioned Node binary, `--max-old-space-size=1024 --test --test-concurrency=1`, followed by all eleven complete files listed in the receipts. Each command was bounded to180seconds. No arbitrary name filter weakened candidate coverage. The baseline executes the full23case actual-host file rather than treating setup failures as behavioral proof.

The five failing old-parent behaviors are selected-brush focus after final Undo, fallback focus when that brush is unavailable, empty measurements, stale live state during a replacement preview, and stale live state after an unavailable frame/arena. Later assertions inside a failed case are not independent baseline evidence. Both candidate runs reach their complete cases.

Original source preimages, old static successor, first erroneous strengthened test, formatter receipts and first-run input manifest remain preserved. Final source production SHA remains `b6cc429d85eb8de198ce9654be27e3762c824fa8b29b45315e4f54b9472d579e`; final host test SHA is `7da7af6e53b18e72cbb957585806ac2d7350b0547f71d8132b067bc7ca49a008`. No game release or native acceptance follows from these bounded results.
