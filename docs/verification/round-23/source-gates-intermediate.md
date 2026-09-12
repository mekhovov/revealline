# Round 23 — final v0.13.0 source validation

All six final gates passed, including **1,405/1,405 tests**, with zero failures, cancellations, skips or TODO cases. All **306 source inputs** stayed unchanged during execution. The [initial failed run](source-gates-initial.md), its [JSON](source-gates-initial.json), [input inventory](source-inputs-initial.json) and raw cache are preserved. This task did not commit, freeze or publish a release.

The final run used **Node v22.22.2**, package **0.13.0**, from **2026-09-12T13:12:08.615Z** through **2026-09-12T13:12:36.820Z**, on a working tree based on `36c3b41ad4faf417f771a3039e02f8666ccf768f`. The inventory, rather than the base commit alone, identifies the exact tested source.

| Gate                                       | Result                                         |
| ------------------------------------------ | ---------------------------------------------- |
| `npm test`                                 | Exit 0; 1,405 passed; minimum guard 1,405      |
| `npm run lint`                             | Exit 0; zero-warning policy                    |
| `npm run format:check`                     | Exit 0                                         |
| `npm run format:native:check`              | Exit 0                                         |
| `npm run validate`                         | Exit 0; 117 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0                                         |

Every command used `mise exec node@22.22.2 -- …` and ran once in this final gate set. The unique total is the prior 1,314 plus 37 enum/router/input cases, 20 library cases, 27 recovery cases and seven settings/navigation cases. Nested motion-lab, controller and practice tests are already part of root discovery; focused runs are not added again. [source-gates.json](source-gates.json) records exact commands, durations, statuses and log checksums.

## Initial failure and final changes

The first run passed 1,403 tests and failed two whole-profile compatibility comparisons because the new Hold preference added 29 serialized bytes. Both tests now assert the added own property and its exact Hold default, remove only that field from an owned comparison value, then compare all older metadata or the exact older byte length and hash. Historical fixtures, route proofs and old expected hashes were not changed.

Exactly three tested paths differ from the initial input inventory: `game/index.html`, `game/test/chapter-reward-integration.test.mjs` and `game/test/mastery-v070-compatibility.test.mjs`. The HTML change moves the existing controller Boost cue nearer the flight status. Browser geometry and controller journeys are separate evidence; these automated gates do not establish viewport or physical-device behavior.

## Exact source and preserved history

The unchanged before/after source aggregate is:

```text
03c43a9460e4a0df802056cec1d5e9b35ab6ef55da5a58d72d0d532d12694dda
```

[source-inputs.json](source-inputs.json) lists the **306 inputs**, their sizes and checksums. Coverage follows Round 22: tracked and non-ignored untracked game, script, platform, motion-lab and authored-library files, plus root package/lock, ESLint and Prettier configuration. Other prose guides and browser screenshots are outside this source inventory.

All **2,829 prior evidence/release files** remained exact, including complete Round 22 report/cache directories, frozen releases, the prepared Round 23 baseline and sidecar, and the initial Round 23 gate cache and three published initial copies. Their unchanged aggregate is `63267be4f7b7c02689ac384fd926474bf6dc6c96d41931eddda8236ebbfc813e`.

The prepared **16-release / 1,646-file / 2,111,529,959-byte** baseline matched, and all **17 captured Git tags** retained exact identities. [The baseline](../../../.cache/round-23/integrity/frozen-releases-before-v0130.json) has SHA-256 `00254c7e002cd104f83b5c77a6ab4176881691f189b3aebf979fe07055ceed89`. This gate does not repeat archive extraction, ZIP CRC or deterministic rebuild checks.

All fourteen log/runner/index/baseline references were independently rehashed and all four source/history index aggregates recomputed before publishing these byte-identical cache copies.

| Report             |  Bytes | SHA-256                                                            |
| ------------------ | -----: | ------------------------------------------------------------------ |
| source-gates.json  |  6,918 | `76adc93037111408d803f39d134df664475c254eb3f02546ceffbeef91fce9a5` |
| source-inputs.json | 52,134 | `b4d84fa450b707b1960de46db7b5b130c807d3222aa2e0ee9edcf247f6829fdf` |

[The final cache](../../../.cache/round-23/source-gates-final/) retains the runner, six raw logs, exact tag identities and before/after inventories. Source validation reports the unchanged 12 base maps, 17 expansion maps across six packs, four themes, seven classes and six optional goals. Four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

This verifies automated behavior and source quality for the recorded working snapshot. Frozen artifacts, browser interaction, physical controllers/devices, native execution, public/store deployment and player enjoyment require separate evidence.
