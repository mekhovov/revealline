# Round 19 — initial v0.9.0 source gates

The initial six-gate run **did not pass**: the single root test invocation passed **1,090 of 1,091 tests**, with one failure and no cancelled, skipped or TODO cases. Lint, source formatting, native formatting, content validation and motion-lab syntax all passed. No source files were changed and no gates were retried during this attempt.

## Failure and tested scope

The failing test was `expansion proof covers every supplied map and rejects altered geometry` at `game/test/expansion-playthrough.test.mjs:19`. It reported `Incomplete expansion proof.` from `scripts/verify-packs.mjs:27`. This failure remains part of the verification history; a later repair needs its own source inventory and run.

The run used **v22.22.2** with package **0.9.0**, from **2026-09-12T10:47:15.359Z** through **2026-09-12T10:47:30.565Z**, on working-tree base **23b124446272124fd48a7b8e27d5cd6ded3e5370**. The expected minimum was 1,091 unique tests. Root `npm test` already includes the motion/controller/practice suites, so none were counted again as separate test runs.

| Gate | Result |
| --- | --- |
| `npm test` | Exit 1; 1,090 passed / 1 failed |
| `npm run lint` | Exit 0 |
| `npm run format:check` | Exit 0 |
| `npm run format:native:check` | Exit 0 |
| `npm run validate` | Exit 0; 106 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0 |

Each command used `mise exec node@22.22.2 -- …`. The validator reported 12 base levels, four themes, seven classes, five indexed packs, 16 expansion maps and six effective goals. Its four existing navigation warnings concern the motion lab, reference atlas, releases browser and native diagnostics.

## Preserved inputs and evidence

All **262 source inputs** matched before and after; aggregate SHA-256:

```text
239a9ef2d68097de77fa5bfc12ada8a6dde8df980c6bb07cffa50944f884c112
```

All **1002 prior evidence files** under `docs/verification/round-18` and `.cache/round-18` remained unchanged; aggregate SHA-256:

```text
7d042598e703357d28bde5bf04df839825be7ba665f7d85950c9ab09b4f89970
```

An independent report inspection rehashed all six logs, the runner and four before/after indexes, checked both index aggregates and parsed the saved TAP totals. These copied reports preserve exact bytes without overwriting earlier evidence:

| Report | Bytes | SHA-256 |
| --- | ---: | --- |
| [source-gates-initial.json](source-gates-initial.json) | 5186 | `9fead8e0ae603a5e3b64dc89e4f857a562594d6cafb9eed42da63ea15172d32d` |
| [source-inputs-initial.json](source-inputs-initial.json) | 44312 | `3ceb15a36e207d085af7729462c738187fbdaa126c62583c8cc322b818127f18` |

The [local run directory](../../../.cache/round-19/source-gates/) contains the original runner, logs and indexes. The source inventory includes tracked and non-ignored untracked game, CLI, platform, motion-lab and authored Homeward source inputs plus package and lint configuration; other documentation is outside its scope.

This is failed source-check evidence. It does not certify a frozen release, browser behavior, physical devices, native execution, distribution or player enjoyment.
