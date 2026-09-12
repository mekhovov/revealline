# Round 19 — repaired v0.9.0 source gates

All six checks passed in **attempt 2**, including **1,098/1,098 tests**, with no failures, cancellations, skips or TODO cases. The [initial failed attempt](source-gates-initial.md) remains preserved: its expansion proof did not cover the newly indexed Workshop maps. The repair added six ordinary-input route proofs and a preservation assertion. The existing parametrized tests also discovered those six new routes, making the actual total six higher than the minimum guard of 1,092. This is one unique root test total, not a sum of repeated focused runs.

The run used **v22.22.2** and package **0.9.0**, from **2026-09-12T10:49:41.937Z** through **2026-09-12T10:49:57.727Z**, on a working tree based on **23b124446272124fd48a7b8e27d5cd6ded3e5370**. The input inventory identifies the tested source; this is not a clean-checkout or frozen-artifact claim.

## Results

| Gate | Result |
| --- | --- |
| `npm test` | Exit 0; 1,098 passed; minimum guard 1,092 |
| `npm run lint` | Exit 0; zero-warning policy |
| `npm run format:check` | Exit 0 |
| `npm run format:native:check` | Exit 0 |
| `npm run validate` | Exit 0; 106 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0 |

Each command used `mise exec node@22.22.2 -- …`. [source-gates.json](source-gates.json) preserves exact commands, durations, exit statuses and log hashes. Root `npm test` already includes motion-lab, controller and practice suites; these were not executed again as separate gates.

Content validation reported **12 base levels, four themes, seven classes, five indexed packs, 16 expansion maps and six effective goals**. The four existing navigation warnings concern the separate motion lab, reference atlas, releases browser and native diagnostics.

## Exact tested source

All **262 source inputs** matched before and after the run. Both aggregate SHA-256 values are:

```text
a07f400b660d6ea4c2c79ed525b19b242110b9e18aa8f04466909002e463f59f
```

[source-inputs.json](source-inputs.json) records each path, byte count and hash. Its scope includes tracked and non-ignored untracked game, CLI, platform, motion-lab and authored Homeward source files plus package/lock and ESLint configuration. Other documentation and this evidence note are outside that input scope.

A separate comparison against the initial attempt found exactly two changed input files: `game/replays/expansion-routes.json` and `game/test/expansion-playthrough.test.mjs`. No source edits, formatting changes or additional retries occurred during attempt 2.

## Independent inspection and preserved history

After completion, independent inspection rehashed all six logs, the runner, four before/after indexes, all 262 recorded source inputs and all 1,017 recorded prior evidence files. It also checked the index aggregates and parsed the saved TAP totals. These reports were copied byte-for-byte using non-overwriting writes:

| Report | Bytes | SHA-256 |
| --- | ---: | --- |
| `source-gates.json` | 5570 | `59a79f28798afee936c3401e6c697b83a061d15a971fcef51b079b2e37a59d7c` |
| `source-inputs.json` | 44312 | `b0dc02cff0b9fd068c35a74a9d15bc4a632869dcb2559c9fd93b9447ff15d53a` |

The [attempt-2 directory](../../../.cache/round-19/source-gates-attempt-2/) retains raw logs, runner and indexes. These cache artifacts are local evidence, not promised distribution contents.

All **1,002 Round 18 evidence files** plus **15 initial-attempt cache/report files** remained unchanged. Their combined before/after aggregate is:

```text
9b0d83a1ce998decd68b2c3fd7e97adf94568d274b1c4380afbded997be593f1
```

The Round 18 subset independently matches its initial-attempt aggregate `7d042598e703357d28bde5bf04df839825be7ba665f7d85950c9ab09b4f89970`. The failed-run report and input index remain available as [source-gates-initial.json](source-gates-initial.json) and [source-inputs-initial.json](source-inputs-initial.json).

Separately, the [pre-v0.9 release inventory](../../../.cache/round-19/integrity/frozen-releases-before-v090.json) captured 12 frozen releases, 1,136 files and 1,491,753,488 bytes. Its SHA-256 is `1d847c9950a1a6d4e8673b7bb2143526313ddf42c5d4f299e577cd355204b94b`. Metadata hashes, every manifest asset and exact Git tag identities matched; the earlier eleven releases also matched the Round 18 baseline. This preserves a comparison baseline and does not repeat archive CRC or rebuild verification.

These checks establish tested source behavior, static validation, formatting and syntax. Frozen artifact reproducibility, browser interaction, physical controllers/touch devices, iOS/WKWebView behavior, native compilation, public/store distribution, network multiplayer and player enjoyment require separate evidence.
