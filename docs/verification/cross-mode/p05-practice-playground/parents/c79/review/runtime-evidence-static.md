# Independent runtime-evidence review

No blocking inconsistency found in the final bounded evidence. This review read the actual logs, receipts, manifests, application delta and test cases; it ran no Node process, tests, browser, build or network operation and changed no candidate source.

## Counts and scope

| Existing run | Complete files | TAP records | Leaf cases | Parent records | Passed / failed leaves |
|---|---:|---:|---:|---:|---:|
| `proposal20-02` — Node 20.19.5 | 11 | 128 | 127 | 1 | 127 / 0 |
| `proposal22-01` — Node 22.22.2 | 11 | 128 | 127 | 1 | 127 / 0 |
| `baseline20-01` — Node 20.19.5 | 1 | 23 | 23 | 0 | 18 / 5 |
| `baseline22-01` — Node 22.22.2 | 1 | 23 | 23 | 0 | 18 / 5 |
| Preserved `proposal20-01` | 11 | 128 | 127 | 1 | 120 / 7 |

Each full run has 103 top-level records: 102 leaves and the parent “practice page keeps virtual holds, releases and import failures isolated from player storage,” which contains 25 child leaves. The passing parent adds one to the TAP pass total. Thus the first run reports 121 passes, and the final runs each report 128; neither number should be described as that many independent leaf behaviors. Repeating the same cohort on two runtimes does not create 256 unique behaviors. All raw summary counts and failure names match their receipts. All five runs report terminal processes, no timeout, and zero skipped, cancelled or todo cases. Commands use sequential test-file concurrency and a **1024 MiB V8 old-space limit**, not a total-memory limit.

## Inputs and before/after boundary

Independently hashed all 901 current proposal files and all 901 behavior-baseline files: both match their manifests, with no extra files in either tree. Both final proposal runs recorded precisely the final proposal manifest; both baseline runs recorded precisely the baseline manifest. Every raw command-log SHA matches its receipt.

The behavior baseline is the **already qualified Controller/Playground candidate**, with the final host test substituted. Comparison with `.cache/p05-practice-playground-170508f1/proposal-inputs.json` finds only that test substitution. It is not bare commit `170508f1`. Final baseline and proposal differ only in `game/playground/playground.mjs`, so the five failures discriminate this follow-up production change. Relative to the qualified parent, the follow-up changes that production file and its host test only.

The initial failed run's input manifest matches the retained first-run manifest. Its host test matches `review/first-run-host-test.mjs`. Initial versus final proposal manifests differ **only in that test file**: production SHA remained unchanged while its fixture was corrected.

## Meaningful behavior and failure attribution

The final actual-entry host test has 23 cases: the prior 13 plus seven Undo cases and three live-measurement cases. It imports the actual HTML-selected entry, authority and application, awaits startup and drains known held/import work during cleanup. Focus, geometry, frame transport and scheduling remain explicit fixtures.

The Undo cases create real class changes through the actual selector handler (Scout → Light carrier / `bomber`, and then Fiber relay / `fiber`). Undo's subsequent `sync()` restores the selector from application state, which makes those restoration assertions meaningful. They cover last Undo returning to the selected brush, surviving Undo retaining focus, unrelated/newer/hidden/unfocused ownership guards, unavailable-brush fallback, and unchanged preview/session identity until explicit Play. Disabled-button focus retirement is modeled; this does not replace a native keyboard retest.

The three measurement cases exercise the actual interval/load/preview handlers using modeled child geometry: empty/nonfinite/zero action bounds and viewport inclusion; immediate pending-preview reset while retaining an explicit geometry snapshot; and missing/invalid/inaccessible document, arena or viewport while preserving that snapshot and preview identity. The six faults in the last case are iterations within one leaf test, not six extra test results. The geometry snapshot format check and byte retention are not a comprehensive native geometry qualification.

Both baseline logs show exactly the same five `ERR_ASSERTION` failures:

1. Last focused Undo leaves no selected-brush focus (`undefined` instead of `signal`).
2. Unavailable-brush fallback leaves body focus instead of the existing preview button.
3. Empty action boxes yield `Infinity × Infinity · all actions visible`.
4. A new preview leaves the prior live dimensions instead of immediate waiting text.
5. An unavailable arena leaves the prior “whole arena visible” reading.

These are not missing-module errors or fixture TypeErrors. Each failed case stops at its first failed assertion; the baseline does not independently demonstrate every later nonfinite branch or preservation assertion failing before the change. The 18 passing baseline cases also matter: they include the existing adoption coverage and the new preservation/ownership guards that should continue to pass.

All seven preserved first-run failures are `TypeError: Cannot read properties of undefined (reading 'classId')` from the test's incorrect access to `JSON.parse(level-json.value).settings.classId`. The JSON field contains the level, not settings. The corrected fixture checks the actual selector restored by `sync()`, verifies each input class really changes, and adds the second genuine Undo restoration. It does not alter production or remove the behavior being qualified. The passing final runs therefore close the fixture correction, while the failed run remains available as historical evidence.

## Formatting and remaining boundaries

`runs/final-format-syntax/receipt.json` and its three logs agree: one Node 22 Prettier check covered the two changed files, and two Node 20 syntax checks covered those same files. All returned zero; the two syntax logs are empty with the recorded empty-file SHA. This is not all six source gates, a build, artifact verification, native browser acceptance or public release acceptance.

Native focus traversal, actual child-game behavior, responsive dimensions, physical devices, public/offline play and integration/release gates are not established by these model results. Historical process timing and terminal status come from the receipts; this audit did not revalidate tool executables or rerun the commands.

## Exact principal pins

| File | SHA-256 |
|---|---|
| `proposal-inputs.json` | `4a4484fb5d8a73abc237a4f873bd83e403273711c2b8a1630c3befd0448f5ded` |
| `behavior-baseline-inputs.json` | `4fdbe9ba587e969e9581d76b0588c5f071e5e3b4b4968b46bf158ffadd1707e6` |
| `proposal/game/playground/playground.mjs` | `b6cc429d85eb8de198ce9654be27e3762c824fa8b29b45315e4f54b9472d579e` |
| `behavior-baseline/game/playground/playground.mjs` | `f242443b2a171ffc5376b9eba5b5ae5dd35a65f820ebaec9d9cda0134cfe1aad` |
| `proposal/game/test/practice-playground-display.test.mjs` | `7da7af6e53b18e72cbb957585806ac2d7350b0547f71d8132b067bc7ca49a008` |
| `review/first-run-host-test.mjs` | `0cdb45447c1ee377049bfdb99cc513ae395f31d6f95bc84e5ae61d3d476875de` |
| `review/first-run-proposal-inputs.json` | `9ef2c3dede3276eb6a90dad0afe829ea28d90bf1df6fde85e8260da65ea6420f` |
| `runs/final-format-syntax/receipt.json` | `c4b996af576053a4971475f059f282b1c5a286219e8ba14eea435da960463b96` |

The companion `runtime-evidence-static.json` records each run/log/receipt/manifest pin and the independent count breakdown.
