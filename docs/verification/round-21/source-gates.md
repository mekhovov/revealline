# Round 21 — final v0.11.0 source gates

All six gates passed, including **1,276/1,276 tests**, with zero failures, cancellations, skips or TODO cases. This was the second actual six-gate execution, stored in `source-gates-attempt-3`: the first cache contains a runner-only preflight error, and the [initial executed gate failure](source-gates-initial.md) remains intact.

The run used **Node v22.22.2**, package **0.11.0**, from **2026-09-12T12:12:57.311Z** through **2026-09-12T12:13:21.813Z**, on a working tree based on `713d1c3c24ba359fd4714c11bbf36cb30ab86efb`. The file inventory identifies the actual tested source; this is not a frozen-artifact check.

| Gate                                       | Result                                         |
| ------------------------------------------ | ---------------------------------------------- |
| `npm test`                                 | Exit 0; 1,276 passed; minimum guard 1,276      |
| `npm run lint`                             | Exit 0; zero-warning policy                    |
| `npm run format:check`                     | Exit 0                                         |
| `npm run format:native:check`              | Exit 0                                         |
| `npm run validate`                         | Exit 0; 112 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0                                         |

Each command used `mise exec node@22.22.2 -- …`. The [JSON report](source-gates.json) retains exact commands, durations, statuses and log hashes. The root test command already includes discovered motion-lab, controller, practice and native-policy suites; focused checks were not repeated or added to this total.

Validation found 12 base maps, 17 expansion maps across six packs, four themes, seven classes and six optional goals. Four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

## Repair and exact source

The original failure exposed missing aggregate coverage for Sentinel's separately authored routes. The repaired verifier checks the original **32** expansion routes plus exactly **two** Sentinel ordinary Interceptor routes, one per turning policy, for **34 map/policy outcomes**. It validates the indexed identity set and reconstructs the selected encounter recordings through replay v4. Ten new regressions cover malformed identities, releases, checkpoints, missing coverage and the guarded discovery writer. The original `expansion-routes.json` remains **81,574 bytes**, SHA-256 `22886cf439f716db31333b3b6d9fae0478f8007aff734632badc7c2f38dc53c8`; it was not regenerated.

Between the failed and final inventories, the remaining changes are the custom viewport controls/helper and their three tests, plus solo/playground sizing corrections. No source file changed during the final run. All **295 input files** matched before and after:

```text
3aed055469e7a9b345e7d9a89b42646fa44be634cb7225cfebd9dbfc0894edfb
```

[source-inputs.json](source-inputs.json) records each path, byte count and checksum. Its scope includes tracked and non-ignored untracked game, CLI, platform, motion-lab and authored-library files, plus root package/lock, ESLint and Prettier configuration. Other documentation is outside this tested-input scope.

## Preserved history and evidence

All **2,586 prior evidence and release files** matched before and after, including Round 20 reports/cache, the failed Round 21 preflight and executed run, their published initial reports, and all frozen releases. The preservation aggregate is:

```text
0b61123bb60b05e396e100e1d165f411b48d77c8e8a9d2a987cdefd30857fa70
```

The prepared **14-release / 1,384-file / 1,798,046,357-byte** inventory matched before execution, and **15 exact Git tag identities** remained unchanged. The [prepared baseline](../../../.cache/round-21/integrity/frozen-releases-before-v0110.json) has SHA-256 `09a10e89db4e4f9c9f94c13f8907da9641bbd6b8c56367252f2e88815bd76b5b`.

All fourteen runner/log/index/baseline references were rehashed, and all four source/history index aggregates recomputed before copying these reports. The copies exactly match the cache and were created without overwriting prior evidence.

| Final report       |  Bytes | SHA-256                                                            |
| ------------------ | -----: | ------------------------------------------------------------------ |
| source-gates.json  |  6,662 | `ac939bc86c7dfad6d58d21138c87470925c88f9619bde54a15eb6862cf8a7e78` |
| source-inputs.json | 50,228 | `1c04d2506325b838738940ed831a2255d40f3e5626d7891d57c2475fc3fc4852` |

The [final cache](../../../.cache/round-21/source-gates-attempt-3/) retains the runner, six raw logs and before/after inventories. [Initial JSON](source-gates-initial.json), [initial inputs](source-inputs-initial.json), their [failure explanation](source-gates-initial.md), and both earlier cache directories remain unchanged. Cache artifacts are local evidence, not promised distribution contents.

These gates establish tested source behavior, validation, formatting and syntax. They do not certify browser interaction, frozen archive reproducibility, physical devices/controllers, native compilation, store/public deployment or player enjoyment. Those require separate evidence.
