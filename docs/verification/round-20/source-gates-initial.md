# Round 20 — initial v0.10.0 source gates

**Historical first attempt.** These checks passed before a later visual correction moved the new-appearance notice out of the scrollable Mission details area. Only `game/index.html` and `game/style.css` changed afterward. This report does not verify that revised placement. The original cache logs and JSON/input reports remain unchanged; a separate second attempt is required after its browser review.

All six checks passed once, including **1,128/1,128 tests**, with no failures, cancellations, skips or TODO cases. Root `npm test` includes the motion-lab, controller, practice and native policy suites. No focused suites were rerun or added to that unique total during this gate run.

The run used **Node v22.22.2**, package **0.10.0**, from **2026-09-12T11:12:39.536Z** through **2026-09-12T11:12:58.787Z**, on a working tree based on **8be20d48bf1336dc8575495889c9bb2bf34f1937**. The source inventory identifies the tested files; this is not a clean-checkout or frozen-artifact claim.

| Gate | Result |
| --- | --- |
| `npm test` | Exit 0; 1,128 passed; minimum guard 1,128 |
| `npm run lint` | Exit 0; zero-warning policy |
| `npm run format:check` | Exit 0 |
| `npm run format:native:check` | Exit 0 |
| `npm run validate` | Exit 0; 106 files and valid literal references |
| `node --check authoring/motion-lab/app.js` | Exit 0 |

Each command used `mise exec node@22.22.2 -- …`. [source-gates.json](source-gates-initial.json) retains exact commands, durations, exit statuses and log hashes. Validation found 12 base maps, four themes, seven classes, five indexed packs, 16 expansion maps and six effective equipment goals. The four existing navigation warnings concern the separate motion lab, reference atlas, release browser and native diagnostics.

## Source and evidence preservation

All **266 source inputs** matched before and after the run. Their aggregate SHA-256 is:

```text
5122bcfdb950484a5539b83ca8eeb3c7b570d8582a931fbf1b54154145b38733
```

[source-inputs.json](source-inputs-initial.json) records each path, byte count and checksum. Its scope includes tracked and non-ignored untracked game, CLI, platform, motion-lab and authored Homeward source; root package/lock, ESLint and Prettier configuration are included. Other documentation is outside this source scope. No source edits or repeated gate attempts occurred during this run.

All **2295 prior evidence and release files** under `docs/verification/round-19`, `.cache/round-19` and `releases` matched before and after, with aggregate:

```text
cc5e3af104d594c8401e6e87e2c69f4ff9a5738f2e656253e20f7f1048f42e9f
```

All **14 exact Git tags** remained unchanged: thirteen release tags plus the original motion-lab tag. The prepared inventory of **13 frozen releases, 1,260 files and 1,644,628,794 bytes** matched before gate execution. Every release metadata/archive/distribution/manifest checksum and each manifest asset matched its expected bytes and hash. The older twelve releases and their tags also matched the previous Round 19 inventory. These checks did not repeat archive CRC, extraction or rebuild validation.

Prepared baseline: [.cache/round-20/integrity/frozen-releases-before-v0100.json](../../../.cache/round-20/integrity/frozen-releases-before-v0100.json), SHA-256 `892fcff7bcd69a6851a8bb607c839a4a3cc403d82d08b43c4369833da154ce3f`.

## Report integrity

Before copying reports, all six saved logs, runner, source/history indexes, prepared inventory and tag indexes were rehashed against the report references. The four input/history index aggregates were recomputed. The following files were copied byte-for-byte with no-overwrite writes:

| Report | Bytes | SHA-256 |
| --- | ---: | --- |
| source-gates.json | 6084 | `b0bef702c882d4a132ff27bbec5d3c110c9ba8888c3833e54bc8c03e0de6f67c` |
| source-inputs.json | 44967 | `b3483190f11fb515a0c70a9caca6f07029ef9ee55849e14f8c0795640966148b` |

The [cache directory](../../../.cache/round-20/source-gates/) retains raw logs, the prepared runner, before/after inputs and exact tag snapshots. Cache files are local verification evidence, not promised distribution contents.

These checks establish source behavior, static validation, formatting and syntax. Browser reward presentation, accessibility interaction, frozen artifact reproducibility, physical devices/controllers, native execution, public/store distribution and player enjoyment require their own evidence. [Reward integration](reward-integration.md) describes the legal-route and persistence assertions; source gates do not substitute for the separate browser review.
