# Round 22 — v0.12.0 working-source validation

All six checks passed, including **1,310/1,310 tests**, with no failures, cancellations, skips or TODO cases. This was one parent-authorized validation run while browser review continued; it did **not** freeze or commit the source. No input changed during the measured run. Any later implementation change needs separate comparison and validation evidence.

The run used **Node v22.22.2**, package **0.12.0**, from **2026-09-12T12:35:21.742Z** through **2026-09-12T12:35:46.916Z**, on a working tree based on `f058073a7d8435b477605b035271d5a8a97463b4`. Exact files are pinned by the inventory, not by that base commit alone.

| Gate                                       | Result                                         |
| ------------------------------------------ | ---------------------------------------------- |
| `npm test`                                 | Exit 0; 1,310 passed; minimum guard 1,308      |
| `npm run lint`                             | Exit 0; zero-warning policy                    |
| `npm run format:check`                     | Exit 0                                         |
| `npm run format:native:check`              | Exit 0                                         |
| `npm run validate`                         | Exit 0; 114 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0                                         |

Each command used `mise exec node@22.22.2 -- …`. [source-gates.json](source-gates.json) contains commands, durations, statuses and raw log checksums. The actual unique total is the prior 1,276 tests plus 22 navigation regressions, ten reading-host tests and two Lab/practice tests. Root test discovery already includes motion-lab, controller, practice and native-policy suites; focused checks were not repeated or added to this gate total.

Validation reports 12 base maps, 17 expansion maps across six packs, four themes, seven classes and six optional goals. Four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

## Exact source and preserved history

All **298 inputs** match before and after. The aggregate SHA-256 is:

```text
5fd9be4ba39ab92e84589462a593463ef5a1ab25c87d84cca1a08f0b0560e4bc
```

[source-inputs.json](source-inputs.json) includes each path, byte count and checksum. Coverage is unchanged from Round 21: tracked and non-ignored untracked game, CLI, platform, motion-lab and all authored-library inputs, plus root package/lock, ESLint and Prettier configuration. Other documentation and browser screenshots are outside this source inventory.

All **2,698 prior evidence/release files** remained unchanged, covering the complete Round 21 report/cache directories and frozen releases. Their preservation aggregate is `53b9931ed71457ff4ef6e9296d3e67eb3207a23838cb08c8fe2d88139352c9b5`.

The prepared **15-release / 1,514-file / 1,954,009,358-byte** inventory matched before execution, and all **16 captured Git tags** retained their exact identities. The [baseline](../../../.cache/round-22/integrity/frozen-releases-before-v0120.json) has SHA-256 `a47babc372faaa1459ab8d836e3decf217ddd81f283561526e0ae12a061560ce`. This gate does not repeat archive extraction, ZIP CRC or deterministic rebuild checks.

All fourteen runner/log/index/baseline references were rehashed and all four source/history index aggregates recomputed before publication. The new report copies match the cache byte-for-byte; no earlier report was overwritten.

| Report             |  Bytes | SHA-256                                                            |
| ------------------ | -----: | ------------------------------------------------------------------ |
| source-gates.json  |  6,227 | `e6eb8501a80b6f82ab69342692561ec3e3a50963e0796e63f652790410dcf516` |
| source-inputs.json | 50,742 | `01e9b19bb69082b090bac601958741a16271e3d6f95d0a97b4601253485d0189` |

The [verification cache](../../../.cache/round-22/source-gates/) retains the runner, six raw logs, tag identities and before/after inventories. These are local evidence, not promised distribution files.

These results establish behavior under automated tests, source validation, formatting and syntax for this exact snapshot. Browser reading/scrolling geometry, controller remapping journeys, frozen-release reproducibility, physical devices/controllers, native compilation, public/store deployment and player enjoyment require separate evidence.
