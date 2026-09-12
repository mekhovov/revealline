# Round 23 — initial v0.13.0 source validation

The initial six-gate run **failed**: 1,405 tests ran, 1,403 passed and 2 failed. Lint, formatting, native formatting, source validation and motion-lab syntax all passed. No source changed during the measured run. This report preserves the original failure; no fix or repeat run is claimed here.

The run used Node **v22.22.2**, package **0.13.0**, from **2026-09-12T13:02:10.752Z** through **2026-09-12T13:02:35.631Z**, on a working tree based on `36c3b41ad4faf417f771a3039e02f8666ccf768f`. The inventory pins the actual tested files; the base commit alone does not identify the changes.

| Gate                                       | Result                                                        |
| ------------------------------------------ | ------------------------------------------------------------- |
| `npm test`                                 | Exit 1; 1,403/1,405 passed, two failures; minimum guard 1,405 |
| `npm run lint`                             | Exit 0; zero-warning policy                                   |
| `npm run format:check`                     | Exit 0                                                        |
| `npm run format:native:check`              | Exit 0                                                        |
| `npm run validate`                         | Exit 0; 117 files, literal references valid                   |
| `node --check authoring/motion-lab/app.js` | Exit 0                                                        |

Every command used `mise exec node@22.22.2 -- …` and ran once. The unique test total is the prior 1,314 plus 37 enum/router/input, 20 library, 27 recovery and seven settings/navigation cases. Root discovery already includes the nested suites; focused runs are not added again. There were no cancellations, skips or TODO cases.

## Two preserved failures

- [Chapter rewards](../../../game/test/chapter-reward-integration.test.mjs): the exact old exported-profile length assertion sees 3,859 bytes instead of 3,830. The new `controllerBoostMode` member accounts for the 29-byte difference.
- [v0.7 mastery compatibility](../../../game/test/mastery-v070-compatibility.test.mjs): whole-profile equality reports the added `controllerBoostMode: "hold"` preference. The old opaque mastery record remains present.

Both assertions compare an old whole-profile oracle to a current export. The proposed repair is to assert the new default explicitly, remove only that member from an owned comparison value and retain the exact old record/byte oracle. That repair has not been performed by this validation run. Archived fixtures and proof expectations were not regenerated.

## Exact input and preserved history

All **306 source inputs** match before and after, with aggregate SHA-256:

```text
c74f7e7c842b32e24417bb503efd9c4fdc5d8bf287c6d4f9a68e97aea22c02bb
```

[source-inputs-initial.json](source-inputs-initial.json) lists each path, byte count and checksum. Coverage follows Round 22: tracked and non-ignored untracked game, scripts, platforms, motion-lab and authored-library files, plus root package/lock, ESLint and Prettier configuration. Other prose guides and browser screenshots are outside this source inventory.

All **2,811 prior evidence/release files** remain exact. The scope covers complete Round 22 report/cache directories, all frozen release trees, and the prepared Round 23 baseline plus sidecar. Their unchanged aggregate is `d549198dbec61ad400e320fca7f59e0fe0838138a4a7600a2a58daf6cf1c7b91`.

The prepared **16-release / 1,646-file / 2,111,529,959-byte** baseline matched and all **17 Git tags** retained exact identities. [The baseline](../../../.cache/round-23/integrity/frozen-releases-before-v0130.json) has SHA-256 `00254c7e002cd104f83b5c77a6ab4176881691f189b3aebf979fe07055ceed89`. This gate does not rerun archive extraction, ZIP CRC or deterministic rebuild checks.

All fourteen log/runner/index/baseline references were independently rehashed, and all four source/history inventory aggregates were recomputed before publishing these byte-identical cache copies.

| Evidence                                                 |  Bytes | SHA-256                                                            |
| -------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| [source-gates-initial.json](source-gates-initial.json)   |  6,384 | `2e2940ebe360545cde6c2f816cfb6ed8970f259ca29c57aa128530d51e3052ed` |
| [source-inputs-initial.json](source-inputs-initial.json) | 52,134 | `e94fd9bc98007f9871902d8a04be1387e76835e4f4fcfac6daf5b4789c15572e` |

[The initial cache](../../../.cache/round-23/source-gates/) retains all six raw logs, the runner and before/after inventories. Source validation still reports 12 base maps, 17 expansion maps in six packs, four themes, seven classes, six optional goals and four existing navigation warnings. No content or gameplay-rule change is inferred from the new input preference.

This is a working-source check, not a release freeze or publication. Browser behavior, physical controllers/devices, native execution, public/store deployment and player enjoyment require separate evidence.
