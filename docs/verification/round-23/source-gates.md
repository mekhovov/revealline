# Round 23 — final v0.13.0 source validation

All six final gates passed, including **1,406/1,406 tests**, with zero failures, cancellations, skips or TODO cases. All **306 source inputs** stayed unchanged during execution. The [initial failed run](source-gates-initial.md), its [JSON](source-gates-initial.json), [input inventory](source-inputs-initial.json), the [passing intermediate result](source-gates-intermediate.json), its [inputs](source-inputs-intermediate.json) and both raw caches are preserved. This task did not commit, freeze or publish a release.

The final run used **Node v22.22.2**, package **0.13.0**, from **2026-09-12T13:14:55.706Z** through **2026-09-12T13:15:26.380Z**, on a working tree based on `36c3b41ad4faf417f771a3039e02f8666ccf768f`. The inventory, rather than the base commit alone, identifies the exact tested source.

| Gate                                       | Result                                         |
| ------------------------------------------ | ---------------------------------------------- |
| `npm test`                                 | Exit 0; 1,406 passed; minimum guard 1,406      |
| `npm run lint`                             | Exit 0; zero-warning policy                    |
| `npm run format:check`                     | Exit 0                                         |
| `npm run format:native:check`              | Exit 0                                         |
| `npm run validate`                         | Exit 0; 117 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0                                         |

Every command used `mise exec node@22.22.2 -- …` and ran once in this final gate set. The unique total is the prior 1,314 plus 37 enum/router/input cases, 20 library cases, 27 recovery cases and eight settings/navigation cases. Nested motion-lab, controller and practice tests are already part of root discovery; focused runs are not added again. [source-gates.json](source-gates.json) records exact commands, durations, statuses and log checksums.

## Initial failure and final changes

The first run passed 1,403 tests and failed two whole-profile compatibility comparisons because the new Hold preference added 29 serialized bytes. Both tests now assert the added own property and its exact Hold default, remove only that field from an owned comparison value, then compare all older metadata or the exact older byte length and hash. Historical fixtures, route proofs and old expected hashes were not changed.

The intermediate run then passed 1,405 tests. A subsequent UI audit found that the cue could offer a Boost action while its button had another meaning outside flight. The final helper defaults to status-only; the app enables an action label only with an assigned controller, flight scope and a running attempt. One new regression covers this eligibility. Exactly three paths differ from that intermediate snapshot: `game/app.mjs`, `game/ui/controller-boost-settings.mjs` and `game/test/controller-boost-settings.test.mjs`.

Across both corrections, six tested paths differ from the initial inventory; the other three are the two compatibility tests and `game/index.html`, which moves the existing cue nearer the flight status. Browser geometry and controller journeys are separate evidence; these automated gates do not establish viewport or physical-device behavior.

## Exact source and preserved history

The unchanged before/after source aggregate is:

```text
63b12b0487fd3a5332e95b8a01222626424f21bfdfb9472592c392ba6fbd48af
```

[source-inputs.json](source-inputs.json) lists the **306 inputs**, their sizes and checksums. Coverage follows Round 22: tracked and non-ignored untracked game, script, platform, motion-lab and authored-library files, plus root package/lock, ESLint and Prettier configuration. Other prose guides and browser screenshots are outside this source inventory.

All **2,847 prior evidence/release files** remained exact, including complete Round 22 report/cache directories, frozen releases, the prepared Round 23 baseline and sidecar, and both earlier Round 23 gate caches plus the three initial and three intermediate published copies. Their unchanged aggregate is `7047b0e04e8a2586dc20f4193dc02b40892940af3317a7849dc8681e94a3726d`.

The prepared **16-release / 1,646-file / 2,111,529,959-byte** baseline matched, and all **17 captured Git tags** retained exact identities. [The baseline](../../../.cache/round-23/integrity/frozen-releases-before-v0130.json) has SHA-256 `00254c7e002cd104f83b5c77a6ab4176881691f189b3aebf979fe07055ceed89`. This gate does not repeat archive extraction, ZIP CRC or deterministic rebuild checks.

All fourteen log/runner/index/baseline references were independently rehashed and all four source/history index aggregates recomputed before publishing these byte-identical cache copies.

| Report             |  Bytes | SHA-256                                                            |
| ------------------ | -----: | ------------------------------------------------------------------ |
| source-gates.json  |  7,324 | `1ecff5a9e3b9c987cf697a29f5e516030cc348e5b01571b2627d35e5dcdacd5a` |
| source-inputs.json | 52,134 | `ea30bf3adee53051f0b754215e5fc23067f423e9438b69667ef869b13f8b79b8` |

[The final cache](../../../.cache/round-23/source-gates-final-2/) retains the runner, six raw logs, exact tag identities and before/after inventories. Source validation reports the unchanged 12 base maps, 17 expansion maps across six packs, four themes, seven classes and six optional goals. Four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

This verifies automated behavior and source quality for the recorded working snapshot. Frozen artifacts, browser interaction, physical controllers/devices, native execution, public/store deployment and player enjoyment require separate evidence.
