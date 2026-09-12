# Round 27 — gallery loading follow-up

**Pass: 25 scoped tests, lint, formatting, validation and a fresh candidate build.** The six new regression cases are included in those 25; the other 19 cases are reruns. The earlier **1,550-test full suite was not repeated**. This report advances the source assessment after the [JSON/CSS follow-up](source-gates.md); its previous reports, inventory and candidate remain intact.

The [machine report](source-gallery-loading-followup.json) and [final 343-input inventory](source-inputs-gallery-final.json) are exact copies of the new runner output. The run used Node.js 22.22.2 from 2026-09-12T16:28:51.381Z to 2026-09-12T16:29:05.560Z, with working-tree base commit `dab6941e37de911fb43ae857e1b66ab501c171f0`.

## Changed behavior and scope

During browser review, an authored picture's asynchronous decode could leave the previous gallery pixels visible under the new title. The [loading fix](gallery-loading.md) hides the existing canvas while keeping its layout box, exposes loading status, and enables celebration/replay only after the selected image paints successfully. Late success or failure from an older view cannot adopt into a newer view. A selected decode failure retains Close and a retry path; failed celebration preparation retains the completed picture, and a successful retry clears the error.

The focused regressions exercise deferred and rejected decodes, rapid selection, guarded synthetic actions and celebration failure/retry through the existing DOM harness. The read-only diff review found no additional concrete readiness/generation defect. Forced decode failures are automated evidence, not a claimed browser failure-injection exercise. No additional library or replay test suites were needed because this change adds no persistence or run-authority path.

Exactly three files differ from the [previous 343-input inventory](source-inputs.json):

| File                                         | Bytes | SHA-256                                                            |
| -------------------------------------------- | ----: | ------------------------------------------------------------------ |
| `game/test/gallery-focus.test.mjs`           | 27438 | `3cd5244b5524539861bfe8d9ce8da1f7d36e1c5636d8bb2c1fcf4a849627e022` |
| `game/test/gallery-reduced-effects.test.mjs` |  6873 | `9f07855b46aaa248f749e9c9e3b0de0397ea3029e89b14582d4238874507ef39` |
| `game/ui/library-panel.mjs`                  | 26332 | `709e9218d4089027a7ca874c990cfcf5a899adf0cf775fb40813fe9dee99a587` |

The new tests are added to an existing file, so the source-input count remains 343. All other inputs—including core, maps, packs, original images, old proofs and fixtures, library schemas, styles and the deployment landing—match the predecessor. The Workshop pack stays 11,127,024 bytes with SHA-256 `a015f79c47d8bac6cd09ba04e50c0c98d759e523eea7d225edbe62a8a5254054`.

## Checks and final source

Each command ran once. Native-format, motion syntax and the full game test suite were not rerun; no deployment command ran.

| Check                                                                                     | Result       | Duration | Evidence                                                                       |
| ----------------------------------------------------------------------------------------- | ------------ | -------- | ------------------------------------------------------------------------------ |
| `node --test game/test/gallery-focus.test.mjs game/test/gallery-reduced-effects.test.mjs` | Pass · 25/25 | 0.76 s   | [Raw log](../../../.cache/round-27/gallery-loading-followup/gallery-tests.log) |
| `npm run lint`                                                                            | Pass         | 2.17 s   | [Raw log](../../../.cache/round-27/gallery-loading-followup/lint.log)          |
| `npm run format:check`                                                                    | Pass         | 3.46 s   | [Raw log](../../../.cache/round-27/gallery-loading-followup/format.log)        |
| `npm run validate`                                                                        | Pass         | 2.56 s   | [Raw log](../../../.cache/round-27/gallery-loading-followup/validate.log)      |
| Fresh CLI candidate build                                                                 | Pass         | 2.88 s   | [Raw log](../../../.cache/round-27/gallery-loading-followup/build.log)         |
| Offline artifact verification                                                             | Pass         | 0.08 s   | [Raw log](../../../.cache/round-27/gallery-loading-followup/offline.log)       |

Validation still reports v0.17.0 and all 13 metadata versions agree. The final source aggregate is **`96d5812adbf1e1886e8ebe34c351c34b690a35469030425d8197041ca2886583`**, identical before and after. The predecessor aggregate `c32eabbe10be44c6f7c3897ddb3904d8468d0085dc681d956a1a45ce0de831f6` remains associated with the earlier JSON/CSS follow-up. This inventory is written to a new filename; `source-inputs.json` was not replaced.

## Fresh candidate and preservation

Candidate [`0.17.0-gallery-candidate`](../../../.cache/round-27/gallery-loading-followup/build/index.html) contains **142 loose outputs / 138 manifest assets / 139 ZIP entries**, with `sourceRevision: null`. All manifest hashes, ZIP local CRCs and ZIP-to-loose byte comparisons passed. The library panel, gallery stylesheet and Workshop pack also match their source files byte-for-byte.

ZIP: **31,850,835 bytes**, SHA-256 `a7ef8c3808c331a22bf8e7f65ba1455d3881191687de0519809833d667082f19`. Offline inventory: **135 files / 31,764,926 bytes**, within the 2,000-file / 64 MiB budget. Build identity `b593b45e9cd6f0f00ea037862d2e010333f82a6d5514836598efa325b85ea306` was independently recomputed; all five game-page markers, worker configuration, inventory hashes and local scopes match. Browser behavior and offline installation are separate evidence; this candidate is not a frozen release.

All **20 earlier releases** (2,198 files, 2,753,850,005 bytes) and **21 exact tag identities** match the original Round27 baseline. The broader **3,925-file preservation audit** includes both previous gate directories, published reports, the preceding candidate and older evidence. Its aggregate remains `4aa0008fafa8015061cd201cb0f5f54d0394a82a7709469fdb57e552dcdfcb5e`. No prior evidence was overwritten.

| Published file                                                               | Bytes | SHA-256                                                            |
| ---------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| [source-gallery-loading-followup.json](source-gallery-loading-followup.json) | 17220 | `285b0d2a1a424d3ed5b09bfd50a96cd218b949c22e4659f0793d7bd62869565c` |
| [source-inputs-gallery-final.json](source-inputs-gallery-final.json)         | 58536 | `ba21f4f9ec26566922b5e78e30b7ef3efa459ccb8e7a09df014840de0ea3620f` |

[Runner](../../../.cache/round-27/gallery-loading-followup/run-followup.mjs), [accepted source hashes](../../../.cache/round-27/gallery-loading-followup/ACCEPTED.json), [before-source index](../../../.cache/round-27/gallery-loading-followup/source-inputs-before.json), [preservation index](../../../.cache/round-27/gallery-loading-followup/prior-evidence-after.json) and [tag index](../../../.cache/round-27/gallery-loading-followup/tags-after.json) retain the exact audit trail. No public-host, physical-controller/touch or native-runtime result is claimed here.
