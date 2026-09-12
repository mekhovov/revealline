# Round 22 — final v0.12.0 source validation

All six checks passed in the final run, including **1,314/1,314 tests**, with no failures, cancellations, skips or TODO cases. The [initial 1,310-test result](source-gates-initial.json), [initial inputs](source-inputs-initial.json), original report copy and raw cache remain intact. No input changed during the final measured run. This task did not commit or publish a release.

The run used **Node v22.22.2**, package **0.12.0**, from **2026-09-12T12:41:00.117Z** through **2026-09-12T12:41:24.687Z**, on a working tree based on `f058073a7d8435b477605b035271d5a8a97463b4`. Exact files are pinned by the inventory, not by that base commit alone.

| Gate                                       | Result                                         |
| ------------------------------------------ | ---------------------------------------------- |
| `npm test`                                 | Exit 0; 1,314 passed; minimum guard 1,314      |
| `npm run lint`                             | Exit 0; zero-warning policy                    |
| `npm run format:check`                     | Exit 0                                         |
| `npm run format:native:check`              | Exit 0                                         |
| `npm run validate`                         | Exit 0; 114 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0                                         |

Each command used `mise exec node@22.22.2 -- …`. [source-gates.json](source-gates.json) contains commands, durations, statuses and raw log checksums. The actual unique total is the prior 1,276 tests plus 26 navigation regressions, ten reading-host tests and two Lab/practice tests. Four navigation regressions were added after the initial run to cover native Done focus return, including both real host surfaces. Root test discovery already includes motion-lab, controller, practice and native-policy suites; focused checks were not repeated or added to this gate total.

Validation reports 12 base maps, 17 expansion maps across six packs, four themes, seven classes and six optional goals. Four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

## Browser-driven corrections and exact source

Browser review after the first run found an ordinary board collapsing at a short desktop breakpoint, an overlay text viewport too small to read comfortably, and Done losing its intended return focus. The final source sets a column-capped 320px arena minimum above the 500px landscape breakpoint, retains at least 90px of overlay text with outer scrolling, and registers Done explicitly so its primary pointer gesture preserves focus until its normal click ends reading. Controls remain 44px.

Exactly six tested paths differ from the initial inventory: `game/README.md`, `game/style.css`, the navigation and host-reading modules, and their two test files. The README change documents the working version. Source browser evidence is recorded separately; these automated gates do not establish viewport or physical-device behavior.

## Preserved source and history

All **298 inputs** match before and after. The aggregate SHA-256 is:

```text
0167da32f9d8153af70f549ec033ed38fa2c04651e63e23a4ebd96e1bf834768
```

[source-inputs.json](source-inputs.json) includes each path, byte count and checksum. Coverage is unchanged from Round 21: tracked and non-ignored untracked game, CLI, platform, motion-lab and all authored-library inputs, plus root package/lock, ESLint and Prettier configuration. Other documentation and browser screenshots are outside this source inventory.

All **2,715 prior evidence/release files** remained unchanged, covering the complete Round 21 report/cache directories, frozen releases, initial Round 22 gate cache and three byte-exact initial report copies. Their preservation aggregate is `f2833856dbcd95753761ba6c7c562e8764b59b0bbef8cd24f387f6700b1b564a`.

The prepared **15-release / 1,514-file / 1,954,009,358-byte** inventory matched before execution, and all **16 captured Git tags** retained their exact identities. The [baseline](../../../.cache/round-22/integrity/frozen-releases-before-v0120.json) has SHA-256 `a47babc372faaa1459ab8d836e3decf217ddd81f283561526e0ae12a061560ce`. This gate does not repeat archive extraction, ZIP CRC or deterministic rebuild checks.

All fourteen runner/log/index/baseline references were rehashed and all four source/history index aggregates recomputed before publication. Final JSON/input copies match the new cache byte-for-byte. Published copies were replaced only after verifying that each original matched its preserved initial copy; the initial evidence remains unchanged.

| Report             |  Bytes | SHA-256                                                            |
| ------------------ | -----: | ------------------------------------------------------------------ |
| source-gates.json  |  6,655 | `3d2ccc671959948d927468f34d071995cd60a5b8d4279dab19dd634d0cc66708` |
| source-inputs.json | 50,742 | `e5ba4b248259200e17eb5f6f28659a3235853d5250c529000fee019a6caa772d` |

The [final verification cache](../../../.cache/round-22/source-gates-final/) retains the runner, six raw logs, tag identities and before/after inventories. These are local evidence, not promised distribution files.

These results establish behavior under automated tests, source validation, formatting and syntax for this exact snapshot. Browser reading/scrolling geometry, controller remapping journeys, frozen-release reproducibility, physical devices/controllers, native compilation, public/store deployment and player enjoyment require separate evidence.
