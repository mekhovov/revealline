# Round 25 — final v0.15.0 source validation

All six final gates passed, including **1,444/1,444 tests**, with zero failures, cancellations, skips or TODO cases. All **312 source inputs** stayed unchanged throughout execution. The validator, build configuration, root/native package metadata, app fallback and iOS marketing versions now agree on **0.15.0**. This task did not commit, freeze or publish a release.

The final run used **Node v22.22.2** from **2026-09-12T14:12:11.093Z** through **2026-09-12T14:12:47.540Z**, on a working tree based on `3e34745baf8791403e71164242cf115047bacaca`. The input inventory identifies the tested source independently of that base commit.

| Gate                                       | Result                                                             |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `npm test`                                 | Exit 0; 1,444 passed; minimum guard 1,444                          |
| `npm run lint`                             | Exit 0; zero-warning policy                                        |
| `npm run format:check`                     | Exit 0                                                             |
| `npm run format:native:check`              | Exit 0                                                             |
| `npm run validate`                         | Exit 0; version **0.15.0**, 119 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0                                                             |

Every command ran once in this final gate set using `mise exec node@22.22.2 -- …`. The unique total is the previous 1,439 plus five control-geometry cases. Motion-lab, controller, practice and other nested cases are already included in root discovery; focused runs and the first full run are not added again. [source-gates.json](source-gates.json) records exact commands, durations, exit statuses, version comparisons and raw-log checksums.

## Initial discrepancy and correction

The [initial report](source-gates-initial.md), [initial JSON](source-gates-initial.json), [initial inputs](source-inputs-initial.json) and [raw cache](../../../.cache/round-25/source-gates/) are preserved unchanged. All six initial commands and 1,444 tests passed, but a manual cross-check found `game/build-config.json` still declared 0.14.0; the validator reported that older value while the package and app declared 0.15.0. The initial runner's success flag did not include cross-file version equality.

Only **game/build-config.json** differs between the two source snapshots. Its version was corrected to 0.15.0. No behavior test, historical fixture, route proof or expected outcome changed. The fresh final runner checks root/native package and lockfile versions, build configuration, app fallback, both iOS marketing declarations and validator output explicitly. All 13 recorded source metadata values match the validator.

## Scope and exact source

This increment adjusts existing solo flight controls and adds a bounded, read-only Playground geometry capture. The five new tests cover actual rectangle intersections independent of declared grid tracks, edge touching, hidden/disabled controls, requested versus actual viewport/media data, arena overlap and conservative content overflow, and invalid/missing geometry. They verify diagnostic behavior using injected DOM measurements; they do not prove browser geometry, hit targets, physical pointer capability or hardware comfort. Actual UI observations remain separate evidence.

The unchanged final before/after source aggregate is:

```text
2ec4bcf53158131757a888b0fc2dfa6a4c94ad3e23955dc69c156b1acd186e7e
```

[source-inputs.json](source-inputs.json) lists all **312 inputs**, sizes and SHA-256 values. Coverage follows Round 24: tracked and non-ignored untracked game, script, platform, motion-lab and authored-library files, plus root package/lock, ESLint and Prettier configuration. Other prose guides and browser screenshots are outside this source inventory.

## Preserved history and reports

All **3,161 prior evidence/release files** stayed exact, including complete Round 24 reports/cache, all frozen releases, the Round 25 baseline and checksum sidecar, and this round's initial gate cache and three published initial reports. Their unchanged aggregate is `74839a081b472e1793809a708b6509106da702bfa5a939f4ef9f165f91ff9051`.

The prepared **18-release / 1,917-file / 2,429,728,545-byte** baseline matched, and all **19 captured Git tags** retained exact identities. [The baseline](../../../.cache/round-25/integrity/frozen-releases-before-v0150.json) has SHA-256 `c3d803cffbc82312bb99713f1e539e44593ead7366a46690320c073e92a5f611`. This run does not repeat archive extraction, ZIP CRC or deterministic rebuild checks.

All fourteen log/runner/index/baseline references were independently rehashed, all four source/history index aggregates recomputed, and the three initial published-report hashes checked before publishing byte-identical final cache copies.

| Report             |  Bytes | SHA-256                                                            |
| ------------------ | -----: | ------------------------------------------------------------------ |
| source-gates.json  |  7,791 | `de3861555c922305d971680176198163d89d1f746465207d6e2fbf0ab151bf2d` |
| source-inputs.json | 53,141 | `3dc1a74fe7932624a5794f90798561e9ee96af8741617211f1237dcc9a4fec96` |

[The final cache](../../../.cache/round-25/source-gates-final/) retains the runner, six raw logs, exact tags and both source/history snapshots. The validator reports the unchanged 12 base maps, 17 expansion maps across six packs, four themes, seven classes and six optional goals. Four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

These results establish automated behavior and source quality for the recorded final working snapshot. Frozen artifacts, browser interaction, physical controllers/devices, native execution, public/store deployment and player enjoyment require separate evidence.
