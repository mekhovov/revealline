# Round 20 — final v0.10.0 source gates

All six checks passed in **attempt 2**, including **1,128/1,128 tests**, with no failures, cancellations, skips or TODO cases. This is one unique root-test total; motion-lab, controller, practice and native-policy suites already belong to it. No focused suites were repeated during this gate run.

The [first passing attempt](source-gates-initial.md) remains intact. A later browser review found that the appearance-reward notice was clipped inside scrollable Mission details. The correction moved the same notice below the picture/status area and adjusted its CSS. Exactly `game/index.html` and `game/style.css` changed between the two tested input inventories; no simulation or JavaScript changed.

Attempt 2 used **Node v22.22.2**, package **0.10.0**, from **2026-09-12T11:25:40.729Z** through **2026-09-12T11:25:59.597Z**, on a working tree based on **8be20d48bf1336dc8575495889c9bb2bf34f1937**. The inventory identifies the actual tested files; this is not a clean-checkout or frozen-artifact claim.

| Gate | Result |
| --- | --- |
| `npm test` | Exit 0; 1,128 passed; minimum guard 1,128 |
| `npm run lint` | Exit 0; zero-warning policy |
| `npm run format:check` | Exit 0 |
| `npm run format:native:check` | Exit 0 |
| `npm run validate` | Exit 0; 106 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0 |

Each command used `mise exec node@22.22.2 -- …`. [source-gates.json](source-gates.json) retains exact commands, durations, exit statuses and log hashes. Validation reported 12 base maps, four themes, seven classes, five indexed packs, 16 expansion maps and six effective equipment goals. The four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

## Exact tested source

All **266 source inputs** matched before and after attempt 2. Their aggregate SHA-256 is:

```text
a96de4954e0308dc867458c48c5b4ddaab202a6892b856f4c4191e3e1d3d5217
```

[source-inputs.json](source-inputs.json) records each path, byte count and checksum. Its scope includes tracked and non-ignored untracked game, CLI, platform, motion-lab and authored Homeward source, plus root package/lock, ESLint and Prettier configuration. Other documentation is outside this input scope. No source changes occurred during attempt 2.

## Preserved history and integrity

All **2312 prior evidence and release files** matched before and after. This includes Round 19 evidence, all releases, the original Round 20 gate-cache directory, and the three historical initial-attempt reports. Their combined aggregate is:

```text
acc221f8f7cc6708658db7a6e275c27714eec43207b3c4efdebbdd0065b7ee0a
```

All **14 exact Git tags** remained unchanged. The prepared **13-release, 1,260-file, 1,644,628,794-byte** baseline also matched before execution. Its metadata/archive/distribution/manifest checksums and every manifest asset were verified, and the older twelve releases matched the prior Round 19 inventory. This does not repeat archive CRC, extraction or rebuild checks.

Prepared baseline: [.cache/round-20/integrity/frozen-releases-before-v0100.json](../../../.cache/round-20/integrity/frozen-releases-before-v0100.json), SHA-256 `892fcff7bcd69a6851a8bb607c839a4a3cc403d82d08b43c4369833da154ce3f`.

All fourteen runner/log/index/baseline references were rehashed, and the four source/history index aggregates were recomputed before publishing. Final JSON/input copies exactly match the new cache. The former published copies were replaced only after matching their preserved initial copies byte-for-byte.

| Final report | Bytes | SHA-256 |
| --- | ---: | --- |
| source-gates.json | 6539 | `ec686df81d4fdeba134dd44a4f8a7c85a581f7c77a9f7d64390bd2d800ee0176` |
| source-inputs.json | 44967 | `a38fcd4ce199a1efd5b3708b36876c1967636ad864b72334d41f2061a73eca37` |

The [attempt-2 cache](../../../.cache/round-20/source-gates-attempt-2/) retains raw logs, runner and before/after snapshots. The original [gate report](source-gates-initial.json), [input index](source-inputs-initial.json), [historical note](source-gates-initial.md), and [first cache](../../../.cache/round-20/source-gates/) remain unchanged. Cache files are local evidence, not promised distribution contents.

These checks establish source behavior, static validation, formatting and syntax. [Reward integration](reward-integration.md) describes legal-route and persistence assertions. Browser reward placement and accessibility interaction, frozen artifact reproducibility, physical devices/controllers, native execution, distribution and player enjoyment require separate evidence; these gates do not substitute for those checks.
