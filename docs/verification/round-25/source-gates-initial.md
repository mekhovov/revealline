# Round 25 — initial source validation

All six commands passed on this first run, including **1,444/1,444 tests**, with zero failures, cancellations, skips or TODO cases. All **312 source inputs** remained unchanged. A separate metadata cross-check found an unresolved release-version mismatch: the root package and app fallback identify **0.15.0**, while `game/build-config.json` and the validator output still identify **0.14.0**. These passing command results therefore do **not** establish a coherent final v0.15.0 release. This initial evidence is preserved before any correction; no source or historical oracle was changed by this task.

The run used **Node v22.22.2** from **2026-09-12T14:09:58.005Z** through **2026-09-12T14:10:29.836Z**, on a working tree based on `3e34745baf8791403e71164242cf115047bacaca`. The input inventory identifies the tested source independently of that base commit.

| Gate                                       | Result                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `npm test`                                 | Exit 0; 1,444 passed; minimum guard 1,444                                |
| `npm run lint`                             | Exit 0; zero-warning policy                                              |
| `npm run format:check`                     | Exit 0                                                                   |
| `npm run format:native:check`              | Exit 0                                                                   |
| `npm run validate`                         | Exit 0; 119 files, valid literal references; reported version **0.14.0** |
| `node --check authoring/motion-lab/app.js` | Exit 0                                                                   |

Each command ran once using `mise exec node@22.22.2 -- …`. The unique total is the previous 1,439 plus five control-geometry cases. Motion-lab, controller, practice and other nested cases are already included in root discovery; focused runs are not added again. [source-gates.json](source-gates.json) records exact commands, durations, exit statuses and raw-log checksums. Its `passed:true` records command success and preservation; this runner did not yet compare validator metadata with the package version.

## Scope and exact source

The increment adjusts existing solo flight controls and adds a bounded, read-only Playground geometry capture. The five new tests cover actual rectangle intersections independent of grid tracks, edge touching, hidden/disabled controls, requested versus actual viewport/media data, arena overlap and conservative content overflow, and invalid/missing geometry. They validate diagnostic behavior with injected DOM measurements; they do not prove browser geometry, hit targets, physical pointer capability or hardware comfort. Actual UI observations remain separate evidence.

The unchanged before/after source aggregate is:

```text
e5705b3ca8623690cc0077e947dd102485f9a4bf90d63d7bea6c426f2adaf891
```

[source-inputs.json](source-inputs.json) lists all **312 inputs**, sizes and SHA-256 values. Coverage follows Round 24: tracked and non-ignored untracked game, script, platform, motion-lab and authored-library files, plus root package/lock, ESLint and Prettier configuration. Other prose guides and browser screenshots are outside this source inventory.

## Preserved history and reports

All **3,144 prior evidence/release files** stayed exact, including complete Round 24 reports and cache, all frozen release directories, and the Round 25 baseline and checksum sidecar. Their unchanged aggregate is `127b096605f29a23ba65ef806115fc87081f6daada9cce26cb29e4d7255e09e8`.

The prepared **18-release / 1,917-file / 2,429,728,545-byte** baseline matched, and all **19 captured Git tags** retained exact identities. [The baseline](../../../.cache/round-25/integrity/frozen-releases-before-v0150.json) has SHA-256 `c3d803cffbc82312bb99713f1e539e44593ead7366a46690320c073e92a5f611`. This run does not repeat archive extraction, ZIP CRC or deterministic rebuild checks.

All fourteen log/runner/index/baseline references were independently rehashed and all four source/history index aggregates recomputed before publishing byte-identical cache copies.

| Report             |  Bytes | SHA-256                                                            |
| ------------------ | -----: | ------------------------------------------------------------------ |
| source-gates.json  |  6,368 | `aab16533e4b7d907ce4287500a6eecfb26b9a00c06105f42c2ea90c8bc5397f3` |
| source-inputs.json | 53,141 | `452f618de7cf28201c34554de7657291ff7dabff8f4b7cd4dca1ee456688f054` |

[The initial cache](../../../.cache/round-25/source-gates/) retains the runner, six raw logs, exact tags and both source/history snapshots. The validator reports the unchanged 12 base maps, 17 expansion maps across six packs, four themes, seven classes and six optional goals. Four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

The version discrepancy requires a deliberate source correction and a newly identified validation result before final release claims. Frozen artifacts, browser interaction, physical controllers/devices, native execution, public/store deployment and player enjoyment require separate evidence.
