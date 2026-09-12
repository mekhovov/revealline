# Round 24 — v0.14.0 source validation

All six gates passed on the first run, including **1,439/1,439 tests**, with no failures, cancellations, skips or TODO cases. All **310 source inputs** stayed unchanged throughout execution. This task did not commit, freeze or publish a release.

The run used **Node v22.22.2**, package **0.14.0**, from **2026-09-12T13:38:22.381Z** through **2026-09-12T13:38:51.576Z**, on a working tree based on `f90946b691666879c70d81547eec10f8ca709383`. The input inventory identifies the tested working source independently of that base commit.

| Gate                                       | Result                                         |
| ------------------------------------------ | ---------------------------------------------- |
| `npm test`                                 | Exit 0; 1,439 passed; minimum guard 1,439      |
| `npm run lint`                             | Exit 0; zero-warning policy                    |
| `npm run format:check`                     | Exit 0                                         |
| `npm run format:native:check`              | Exit 0                                         |
| `npm run validate`                         | Exit 0; 118 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0                                         |

Every command used `mise exec node@22.22.2 -- …` and ran once. The unique total is the prior 1,406 plus six Retry projection cases, 26 integration cases and one router/navigation case. Root discovery already includes motion-lab, controller and practice tests; focused runs are not counted again. [source-gates.json](source-gates.json) records exact commands, durations, statuses and raw-log checksums.

## Scope and exact source

This increment adds bounded explanations and recovery tips for terminal failures. The new controller regression uses the real router and DOM navigation adapters to check reader exits and a held Retry Confirm across a host scope transition, including default ability and remapped Toggle Boost buttons. Its activation counter verifies the DOM boundary, not a complete app launch or game authority. Legal loss, replay and retained-progress behavior have separate integration assertions. The tested source includes the final compact-screen consequence placement inside the existing reading region; geometry and interaction claims require the separate browser report.

The unchanged before/after source aggregate is:

```text
fb5db87044538f9dd2f5f2e1642999714cc175d0a656acdf0a973625ecc30c2f
```

[source-inputs.json](source-inputs.json) lists all **310 inputs**, their sizes and checksums. Coverage follows Round 23: tracked and non-ignored untracked game, script, platform, motion-lab and authored-library files, plus root package/lock, ESLint and Prettier configuration. Other prose guides and browser screenshots are outside this inventory.

## Preserved history and reports

All **3,134 prior evidence/release files** stayed exact, including the complete Round 23 reports and cache, all frozen releases, and the prepared Round 24 baseline with its checksum sidecar. Their unchanged aggregate is `29e978277d985e3027ccf0d28f3df492daa2e53021fc02bdbec366c27fe1e6e5`.

The prepared **17-release / 1,781-file / 2,270,137,660-byte** baseline matched, and all **18 captured Git tags** retained their exact identities. [The baseline](../../../.cache/round-24/integrity/frozen-releases-before-v0140.json) has SHA-256 `1ef4966fee967e808e9c46c08b7c668e95174d1585e5f69ae77cb94c713508d7`. This run does not repeat archive extraction, ZIP CRC or deterministic rebuild checks.

All fourteen log/runner/index/baseline references were independently rehashed and all four source/history index aggregates recomputed before publishing byte-identical cache copies.

| Report             |  Bytes | SHA-256                                                            |
| ------------------ | -----: | ------------------------------------------------------------------ |
| source-gates.json  |  6,363 | `13b82dcd37dff0aadfb9ce3911c346f5ef671a86d0370806b720914b9a8e68c6` |
| source-inputs.json | 52,800 | `427943dea68086bc4ee4edec031228959d9ebb37f575defc07c4e03f1590a7e0` |

[The cache](../../../.cache/round-24/source-gates/) retains the runner, six raw logs, exact tag identities and before/after inventories. Source validation reports the unchanged 12 base maps, 17 expansion maps across six packs, four themes, seven classes and six optional goals. Four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

These results establish automated behavior and source quality for this recorded working snapshot. Frozen artifacts, browser interaction, physical controllers/devices, native execution, public/store deployment and player enjoyment require separate evidence.
