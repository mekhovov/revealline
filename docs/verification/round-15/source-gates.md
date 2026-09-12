# v0.5.0 source gates

All ten checks passed on **12 September 2026**, from 08:42:12 to 08:42:22 UTC, using **Node 22.22.2** through mise. The working source was based on commit `107886d8fb3be1b5deb811f254e8535df3eab74c`; package and build configuration identified v0.5.0. This gate run made no source edits or commits.

| Command, prefixed with `mise exec node@22.22.2 --` | Observed result |
| --- | --- |
| `npm test` | **700 passed**, zero failed, skipped, cancelled or pending |
| `npm run lint` | Passed |
| `npm run format:check` | Passed |
| `npm run format:native:check` | Passed |
| `npm run validate` | Passed: 95 source files, valid literal references, 12 base maps, four themes, seven classes |
| `node --test authoring/motion-lab/test-*.mjs` | **70 passed**, zero failed, skipped, cancelled or pending |
| `node --check authoring/motion-lab/app.js` | Passed |
| `node --test game/test/controller-navigation.test.mjs` | **30 passed**, zero failed, skipped, cancelled or pending |
| `node --test game/test/controller-preview.test.mjs game/test/controller-lab.test.mjs` | **25 passed**, zero failed, skipped, cancelled or pending |
| `node --test game/test/practice-navigation.test.mjs` | **8 passed**, zero failed, skipped, cancelled or pending |

The three focused controller/practice runs are subsets of the 700-test main suite. They confirm the exact counts for focus-only controller engagement, editable controls and cancellation, preview/lab behavior, and practice navigation guards. They are not added to the unique main-suite total. The 70 Motion Lab tests are separate; the runner enumerated all five current test files, as recorded in the JSON, rather than passing an unexpanded wildcard to Node.

The [gate record](source-gates.json) contains exact commands, timestamps, durations, test totals, validation output, runner identity, and log paths/sizes/SHA-256 hashes. The adapted runner and distinct raw logs are in `.cache/round-15/source-gates/`. Each output uses exclusive creation so this run cannot overwrite earlier evidence.

The [227-file source inventory](source-inputs.json) covers tracked and untracked runtime, tooling, native-project, Motion Lab and Homeward authored-source inputs, plus package/configuration files. Its SHA-256 was identical before and after all checks:

`12c2e2a0c18fae377ce22bdcd4764909ad48209da1cb3da21527e0d37d538248`

No inventoried source changed during the run. Documentation and verification artifacts are outside that source hash.

All **1,396 existing round-14 evidence files** were individually hashed before these checks and reread afterward: **26 files** under `docs/verification/round-14/` and **1,370 files** under `.cache/round-14/`. Every hash remained unchanged. The gate record includes each original hash and its observed post-run match; no v0.4.0/v0.4.1 evidence was replaced.

Structural validation still reports four navigation warnings: Motion Lab, the reference atlas, the release directory, and native diagnostics. The exact source/destination paths are in the JSON. They are dynamic or distribution-dependent navigation destinations, and this source-validation result does not certify them.

These results verify current automated source behavior. They do not certify a frozen v0.5.0 artifact, actual browser accessibility trees, physical controller behavior, or native device execution. Browser observations are recorded separately in [source browser verification](source-browser.md); the focused fake-DOM tests verify label placement and stable name-source text without claiming to implement a browser accessibility tree.
