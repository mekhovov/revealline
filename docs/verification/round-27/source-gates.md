# Round 27 — source gates and targeted follow-up

**The combined source assessment passes.** The initial source passed **1,550 unique tests** and five gate categories; its generated Workshop JSON failed formatting. The approved JSON whitespace repair and separately reviewed gallery CSS change then passed the targeted follow-up. The full test suite was **not rerun on the final CSS**. The [machine summary](source-gates.json), [initial failed-attempt report](source-gates-initial.md), [raw follow-up report](source-format-followup.json) and [final 343-file inventory](source-inputs.json) retain those distinct scopes.

The initial run used Node.js 22.22.2 at base commit `dab6941e37de911fb43ae857e1b66ab501c171f0`. Its 1,550 cases comprise the earlier 1,521 plus eight Workshop-builder cases, six gallery reduced-effects cases and 15 art/transport integration cases. All passed with zero failures, cancellations, skips or todos. Earlier focused checks are not counted again.

| Gate category                              | Result           | Tested source   | Evidence                                                               |
| ------------------------------------------ | ---------------- | --------------- | ---------------------------------------------------------------------- |
| `npm test`                                 | Pass · 1550/1550 | Initial source  | [Raw log](../../../.cache/round-27/source-gates/test.log)              |
| `npm run lint`                             | Pass             | Initial source  | [Raw log](../../../.cache/round-27/source-gates/lint.log)              |
| `npm run format:check`                     | Pass             | Final follow-up | [Raw log](../../../.cache/round-27/format-followup/format.log)         |
| `npm run format:native:check`              | Pass             | Initial source  | [Raw log](../../../.cache/round-27/source-gates/native-format.log)     |
| `npm run validate`                         | Pass             | Initial source  | [Raw log](../../../.cache/round-27/source-gates/validate.log)          |
| `node --check authoring/motion-lab/app.js` | Pass             | Initial source  | [Raw log](../../../.cache/round-27/source-gates/motion-lab-syntax.log) |

Validation was also repeated in the final follow-up and passed. Both validator outputs report v0.17.0, 127 runtime files, 12 base maps plus 17 expansion maps across six packs, seven classes, four themes and six effective optional goals. The three optional First Flight lessons are separate. All 13 version values match. The 21 navigation-warning entries remain in the logs; literal references pass, without establishing hosted navigation.

## Final changes and checks

Exactly two of the 343 audited inputs differ from the full-test inventory:

- `game/content/packs/equipment-workshop.json`: formatting only, from 11,127,186 to **11,127,024 bytes**. The final SHA-256 is `a015f79c47d8bac6cd09ba04e50c0c98d759e523eea7d225edbe62a8a5254054`. Parsed JSON, all three embedded image strings and the entire resolved campaign remain exactly equal. The campaign key stays `equipment-workshop/1/3fc2cf073da368b4`.
- `game/style.css`: the separately authored gallery media query for windows at least 681 pixels wide and at most 500 pixels high. Final SHA-256: `ff76434cf62769246d1808b0b77645f54d5a67de6b12e3a9b9c7fefcb438cfb5`. Browser acceptance is recorded separately; this audit does not infer rendering behavior from CSS bytes.

Original PNG files, replay proofs, recorded browser fixtures and their earlier pack hashes were not regenerated. The builder's read-only check accepts equivalent JSON formatting and confirms the exact selected source images. The Node image adapter validates headers and byte transport; it does not decode PNG pixels.

The follow-up ran from 2026-09-12T16:13:06.629Z to 2026-09-12T16:13:22.307Z. Each command below ran once; unchanged lint, native-format, syntax and full-test commands were not repeated.

| Follow-up                                                                                                                                          | Result | Duration | Evidence                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ---------------------------------------------------------------- |
| `npm run format:check`                                                                                                                             | Pass   | 2.71 s   | [Raw log](../../../.cache/round-27/format-followup/format.log)   |
| `npm run validate`                                                                                                                                 | Pass   | 2.07 s   | [Raw log](../../../.cache/round-27/format-followup/validate.log) |
| `node scripts/build-workshop-pack.mjs`                                                                                                             | Pass   | 1.36 s   | [Raw log](../../../.cache/round-27/format-followup/builder.log)  |
| `node scripts/game-cli.mjs build --out .cache/round-27/format-followup/build --version 0.17.0-format-candidate`                                    | Pass   | 2.20 s   | [Raw log](../../../.cache/round-27/format-followup/build.log)    |
| `node .cache/round-27/format-followup/verify-offline.mjs .cache/round-27/format-followup/build /Users/oleksandr.mekhovov/work/my_projects/go_test` | Pass   | 0.07 s   | [Raw log](../../../.cache/round-27/format-followup/offline.log)  |

The final source aggregate is **`c32eabbe10be44c6f7c3897ddb3904d8468d0085dc681d956a1a45ce0de831f6`**, identical before and after the follow-up. The earlier aggregate remains `4a14c2439fe04b253374c43016e71d6ac83253403499fa7d4396b8c683c8da7f`. The scope includes the accepted deployment landing at `5fa8e3e`, the CLI, site assets, Pages workflow, runtime, native scaffolds and source authoring/library files. External concept images under `docs/concepts/generated_images/` are excluded. No deployment or `build:pages` command ran.

## Candidate and preservation

The fresh candidate is [`0.17.0-format-candidate`](../../../.cache/round-27/format-followup/build/index.html), built from the working tree with `sourceRevision: null`. It contains **142 loose outputs, 138 manifest assets and 139 ZIP entries**. Every manifest asset hash matches its loose file; every local ZIP entry passes CRC and matches its loose bytes. The formatted Workshop pack is byte-identical in source, loose output and ZIP.

Its ZIP is **31,849,192 bytes**, SHA-256 `3be25cc24730ab48fe53329c116564125d155e405bd4d3a14c75ee565c515d5e`. The offline inventory contains **135 files / 31,763,286 bytes**, within the 2,000-file / 64 MiB budget. Build identity `589100977e9f3e2b155e366e13b954db0c37804f163a1c1d6121b0af2b430c8e` was independently recomputed; all five game HTML markers, worker configuration, manifest inventory and asset hashes match. These are candidate artifact checks, not a frozen release or a browser offline test.

All **20 earlier release trees** (2,198 files, 2,753,850,005 bytes) and **21 exact tag identities** still match the original Round27 baseline. The final preservation audit covers **3,764 files**, including all initial failure output and reports, original preformat Workshop bytes, prior Round26 evidence and Round27 focused checks. Its before/after aggregate remains `3a0c4df44cef38a688418ef60252e37213c6cbfe05ac138eb56da06338ffa537`. No earlier evidence or frozen tree changed during either run.

| Published file                                             | Bytes | SHA-256                                                            |
| ---------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| [source-gates.json](source-gates.json)                     | 18430 | `b0789d5d24e6b6efd27a6a2d79411167c1524637e1cbfabcd5c606ba9a4d5251` |
| [source-format-followup.json](source-format-followup.json) | 17465 | `7c8fb4d5ff5aab4eaca4e1d95c325bf68f4c7eb0a7f1cebcb75c96a977a83e2e` |
| [source-inputs.json](source-inputs.json)                   | 58536 | `6ca8e121636359b584d5421d7d69d28f6a19287ef7483d5d7fa854b185d95150` |

The follow-up JSON and final input inventory are byte-identical cache copies. [Initial pins](source-gates-initial.md), the [follow-up runner](../../../.cache/round-27/format-followup/run-followup.mjs), [source-before index](../../../.cache/round-27/format-followup/source-inputs-before.json), [preservation-after index](../../../.cache/round-27/format-followup/prior-evidence-after.json) and [tag-after index](../../../.cache/round-27/format-followup/tags-after.json) retain the audit trail. This evidence does not establish public hosting, physical touch/controller behavior, native execution, general accessibility or player enjoyment.
