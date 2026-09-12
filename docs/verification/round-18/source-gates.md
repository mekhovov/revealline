# Round 18 — v0.8.0 working-source gates

All six source gates passed. The single root test run passed **985/985 tests**, with zero failed, cancelled, skipped or TODO cases. It includes the motion-lab, controller and practice suites; these were not run again as separate gates or counted twice.

The run used **Node v22.22.2**, beginning **2026-09-12T10:21:46.952Z** and recording completion at **2026-09-12T10:21:59.280Z**. Package version was **0.8.0**, with a working tree based on **c92629e81a2154a74e4bb7f2e27b3c41b50f074f**. The input inventory identifies tested source; this is not a frozen-artifact or clean-checkout claim.

## Results

| Gate | Observed result |
| --- | --- |
| `npm test` | 985 passed; minimum guard 985 |
| `npm run lint` | Exit 0; zero-warning policy |
| `npm run format:check` | Exit 0 |
| `npm run format:native:check` | Exit 0 |
| `npm run validate` | Exit 0; 104 files; literal references valid |
| `node --check authoring/motion-lab/app.js` | Exit 0 |

Each command ran through `mise exec node@22.22.2 -- …`. [source-gates.json](source-gates.json) retains exact commands, durations, exit statuses, test totals and raw-log hashes. The test guard requires the pass count to equal the total and every failure/skip/cancellation/TODO count to be zero. Its minimum detects an unexpectedly small run, not product completeness.

The content validator reported the base `first-signal` campaign's **12 levels, four themes and seven classes**. Four navigation warnings point to the separate motion lab, Round 9 reference atlas, release browser and native diagnostics. They are not missing literal runtime resources. The base-level count excludes expansion maps.

## Stable inputs and independent inspection

All **253 source inputs** matched before and after the checks. Both aggregate SHA-256 values are:

```text
89f1cc46426286b57be5bb3ecf272122836d72ccf615bb6db50f595888ec70e5
```

[source-inputs.json](source-inputs.json) records each path, byte count and hash. The inventory covers tracked and non-ignored untracked files under `game/`, `scripts/`, `platforms/`, the motion lab and authored Homeward source library, plus package/lock and ESLint configuration files. Other documentation and this evidence note are outside that tested-input scope.

After completion, a separate inspection rehashed all six raw logs, the runner, four before/after indexes, every recorded source input and every recorded prior evidence file. It independently parsed the saved TAP totals and checked both index aggregates. These reports are byte-for-byte copies created without overwriting earlier evidence:

| Report | Bytes | SHA-256 |
| --- | ---: | --- |
| `source-gates.json` | 5,110 | `e19d09b7018ba8d60426c0142de6c05a979c16e2d04e4451ab1e18cf98f0d988` |
| `source-inputs.json` | 42,779 | `3d71df14007b748359b8d9c39a75ed76174edb86b3aec8be1fa7479be0103e51` |

The [local gate directory](../../../.cache/round-18/source-gates/) retains the runner, raw logs and before/after indexes. These cache artifacts are local evidence, not promised contents of the distribution. No source formatting, runtime changes or gate retries occurred during this run.

## Preserved history and limits

All **937 previous evidence files** under `docs/verification/round-17` and `.cache/round-17` were unchanged. Their before/after aggregate is:

```text
6e606f81c765cfb6f33281740bbdc3e47a60ab5926897f2034ac1ba400694032
```

Separately, the [pre-v0.8 frozen-release inventory](../../../.cache/round-18/integrity/frozen-releases-before-v080.json) captured all 11 existing release directories: 1,014 regular files, metadata-matching source/ZIP/manifest hashes, all manifest asset hashes and exact Git tag identities. Its SHA-256 is `f29564bdff255309f710e35a12c105fc5cbbec1964bcb5ab5e571721ecee5907`. That capture preserves a comparison baseline; it does not rerun archive CRC or prove a future build reproducible.

These results establish source tests, static validation, formatting and syntax. Frozen archive reproducibility, browser interaction, physical controllers/touch devices, iOS/WKWebView execution, native compilation, store distribution, network multiplayer and player enjoyment require separate evidence.
