# Shared scenario projection boundary — 17 October 2026

## Change and source scope

Normal Solo statically imported `ui/edition-controller-practice.mjs`, which imported the entire `playground/model.mjs` editor model to call `entryScenario`. This change moves `entryScenario` and its `editorScenario` helper unchanged into `game/scenario-entry.mjs`. Controller practice imports that shared projection directly. The editor model imports and re-exports the same function objects, preserving its public API and its internal calls.

The change introduces no asynchronous boundary, deferred evaluation during active play, cancellation gap, new projection rules, or new content validation. `CLASSES` comes from the same registry object already re-exported by the core entry point. Campaign identity, settings, class selection, mastery definitions, theme/music selection, cloning and validation remain unchanged.

The source control is `adb1c0c7b7dd1a526a0693917f2012d1dbc08b22` (runtime `488eae03a`). Later tooling/doc commits were present while testing, but all examined game bytes were checked against that frozen source before applying the proposal. The currently running production artifact belongs to that older source; it does not qualify this extraction.

## Exact static graph result

A parser-only traversal from `game/app.mjs` counts 583 static modules in both graphs. The original graph contains 7,981,632 UTF-8 source bytes; the proposed graph contains 7,954,953, removing 26,679 bytes. Only `game/playground/model.mjs` leaves the reachable graph, replaced by `game/scenario-entry.mjs`. These are source counts, not measured download, compilation, frame-time or device savings.

The moved function bodies are byte-identical:

| Function         | Bytes | SHA-256                                                            |
| ---------------- | ----: | ------------------------------------------------------------------ |
| `editorScenario` |   287 | `b13a93d8703bac1f681f30270b270e98ad29010dc69c2f76b483a7ad1172c83e` |
| `entryScenario`  | 3,798 | `6246ed4a684fd3b52f65117afb92dfd686c67e2eee95f42c1f41f305ba11aeb4` |

The reviewed three-runtime-file diff is 10,941 bytes, SHA-256 `ae909abcac82cb8e7f0d12c98c340b028833ab1d6669abb7628b484eb912e4a8`. The complete graph is retained at `.cache/solo-followup/eager-graph-adb/proposal/graph.json` (188,289 bytes, SHA-256 `1c0f332c4fd051bf39b514ca060a864ae5b6478f2acaf971e7703c2dee91498c`).

Other eager modules remain intentional follow-up boundaries. Soundtrack UI also owns stored source/settings preparation; the library owns gallery, export, backup and cancellation. Content-project compilation validates every authored mission mode, and the small Studio preview-readiness module serves the player's Guide. Removing those imports without preserving their required work is outside this extraction.

## Matched controls and retained failures

Node 22.22.2 ran the complete playground-model, scenario-mastery, edition-controller-practice, edition-solo-host and enemy-guide-edition-host files on unchanged game source and the cache-only proposal, using test concurrency 2. All 78 outcome records, failure types/codes and test locations matched: **67 passed, 5 failed, 6 cancelled** on each side. Neither full run is a passing suite.

The failures were two edition waits that dereferenced an absent Missions dialog before asynchronous creation, two Guide assertions expecting immediate opening, and one editor import without the required browser decoder. A separate editor promise remained pending, cancelling that case and five following cases. No Guide or decoder behavior was changed. Separately executing those five following editor cases produced four passes and the same missing-decoder failure on each version; it does not repair the cancelled full runs.

Only the two Missions waits were corrected to accept an absent dialog until it actually opens. The existing deadlines and subsequent mission filtering, settings/export and installed-content isolation assertions remain intact. Both cases passed on unchanged source and the proposal: 2/2, exit 0, with whole-process elapsed times of 61.307 and 61.367 seconds respectively. These are host-test process durations, not gameplay performance measurements.

An initial cache prototype omitted V2 constants from the generated import list. Its failing 63-pass/15-fail run remains retained. The header was corrected before the matched controls and reviewed diff; no tracked runtime used that prototype.

All raw TAP files below remain under `.cache/solo-followup/eager-graph-adb/proposal/`:

| Receipt                              |  Bytes | SHA-256                                                            |
| ------------------------------------ | -----: | ------------------------------------------------------------------ |
| `contracts-unchanged-adb.tap`        | 23,641 | `7703f2d3c9cece338a56f0a61338d28c87cda17d4851f35e11d289654212ef6b` |
| `contracts-v2.tap`                   | 25,650 | `f02a46b7d78caf4dea41964e8e2e35e9d80fb64097657c5ca3b376605a556def` |
| `contracts.tap` (rejected prototype) | 33,271 | `d1b9acfc12b3213b516073071858b9148188797e05a520b2f699cbbab37965aa` |
| `edition-opening-unchanged.tap`      |  1,028 | `7d0702c072fb1027730a4e329c1a84541d0a629ad34691169af32674e47b2208` |
| `edition-opening-proposal.tap`       |  1,028 | `b5ffe987738ebc30b3401a3c577d8e066ee618545d7a2a9593476a17fa70ce0d` |
| `editor-isolated-unchanged.tap`      |  2,640 | `dc4f4d3765fd12f3881ef2bb65c120be17e6d2f6ad3c1a34143a9a41f5cb063a` |
| `editor-isolated-proposal.tap`       |  3,037 | `9f52d34a9f903ecf2e5ba11c378dde2ff711e31244d5d96f1246fdf0b3e53210` |

The source identities and all matched outcome rows are retained in `comparison.json` (36,048 bytes, SHA-256 `b8ed28b404cc050648eae53b227fa15890b10ba527c19f7891d1978b243929aa`).

## Applied-source verification and remaining limits

The complete controller-practice, scenario-mastery and edition-solo-host files pass on the applied source: **67/67, exit 0**, no failures, cancellations or skips, in 68.351 seconds. `contracts-applied.tap` is 14,089 bytes, SHA-256 `beba83da15648d51faf0045d6d098f03e3fbdb85ce476f8c8434704674aa3d48`. This separate passing three-file check does not replace the full five-file failure controls above. Scoped lint, formatting and direct public re-export identity checks also pass.

No browser or physical device was used. This change removes an unnecessary editor dependency but does not establish the performance gates, repair the retained unrelated failures, or qualify Steam Deck Chrome or iPhone Safari. Native earned capture/erosion, source-matched timing, sustained conditions and physical-device checks remain separate work.
