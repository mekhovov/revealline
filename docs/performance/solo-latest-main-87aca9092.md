# Latest-main integration checks at 87aca9092

## Source and scope

The performance branch merged upstream `8b01991942dc764b8aa4726851699ce1985e53ae` in `87aca909201ae0a2520d5856dbca351b82dd6e2d`. These checks exercise current-rules saved-flight recovery, historical picture ownership and owned offline update behavior. They are Node 22.22.2 correctness checks, not browser performance qualification or physical-device evidence.

The upstream current-rules save extension, including native `xonix-session.v7`, was imported coherently with its session, backup, attempt-file and artwork recovery owners. Performance fixture repairs below change neither those formats nor production code.

## Results and fixture corrections

The original 17-file suite ran with file concurrency 2 and a 600s whole-run bound. It retained all 209 observations: 205 passed and four failed. The covered files are listed exactly in the retained command receipt. Offline activation tests require migration/recovery checks before worker preparation, all three ownership locks during preparation and preservation of the prior selection after failure.

Both picture-retry cases completed the actual run, then waited for result controls while the generic async helper submitted only zero-time frames. The existing 2.4s reward presentation therefore could not age. The corrected fixture submits at most 300 actual 60 Hz frames, requires the real result control to appear, and verifies the authoritative won checkpoint is unchanged. It retains all subsequent cancellation, input and late-resume assertions.

Both historical restart cases assumed the current saved object was directly native v4. The already-existing accepted-artwork envelope contains native v6 with actor metadata and an explicit null complete-theme pin. The fixture now validates the entire accepted envelope, checks its exact native version, constructs and validates the intended historical v4/v2 import by removing incompatible metadata, then requires Restart to preserve that exact historical native envelope, picture choices and strict replay. It does not invent a modern artwork wrapper for an explicitly imported old native file.

A Node load hook substituted exact 1cc runtime blobs for all 32 changed game MJS paths, preserving original module URLs; unchanged runtime modules retained identical bytes. New modules absent at 1cc were rejected if requested. The two fixtures, host helper and their classes/themes inputs were unchanged between 1cc and the merge before correction. This is an exact runtime control for these cases, not a claim that all unrelated package data was restored to 1cc.

All four original failures reproduced against that prior runtime. Both retry corrections passed against unchanged 1cc; the first legacy correction exposed two further stale assumptions, and those failed attempts are retained as well. The final two legacy cases passed against unchanged 1cc. The complete corrected `flight-pictures-host.test.mjs` and `restart-picture-retention.test.mjs`, plus full `offline.test.mjs`, then passed 88/88 on the merged runtime with concurrency 2 and unchanged individual deadlines. No skips, cancellations, runtime changes or gate waivers were used. Targeted lint, formatting and diff checks passed.

## Earlier Appearance failure

Hosted Appearance run 38995660498 at source `1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f` failed one of 1025 tests: Collection touch disclosure timed out before its assertions while waiting for the initial picture under the existing 15s guard. The witness reported `pictureState=pending`, an empty selected pack and no page errors. All other 1024 passed, with no skips or cancellations. It is retained as a failure; this record does not classify its cause as resource contention or a production defect.

Artifact 12088265072, 48,709 bytes, SHA256 `fe2592dba2ef81d6a48d2e2c7c036f4fc3a0b001a53bf2592efb5e1e132277f4`, was fully downloaded, member-CRC checked and read back under `.cache/solo-followup/remote-appearance-38995660498/preview-retained`. The same current merged-source case separately passed the unchanged deadline in the critical-controller suite; that suite owns its complete results.

## Neon verifier status

The upstream original 216-case saved-flight verifier exceeded a separately declared 180s local process bound without a final report. An observer-only cache copy retained every original assertion and input, added stage/case progress and kept the same 180s bound. It completed 145 cases before interruption. Initial catalogue preparation took about 1.7s; first recording, save, snapshot and restore completed productively, followed by more expensive Mosaic cases. Neither interrupted run is a correctness pass.

A separately declared 360s original-verifier successor is running based on that measured finite work. It uses the unchanged upstream script and all 216 cases. Its result remains pending here; a later result receipt must be read before claiming completion. This bound is for standalone engine correctness verification and changes no gameplay timing threshold. No automatic repeat is authorized if it remains inconclusive.

## Retained evidence

All paths below are relative to `.cache/solo-followup/latest-main-87aca9092/`. Raw observations are retained, including each failed attempt. The control directory also retains its original immutable module bytes and per-attempt command/source receipts. No browser, server, build archive or external drive was used by these checks.

| Observation                            | Relative path                                        | Result                                                                     | Bytes | SHA256                                                             |
| -------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| Initial 17-file suite                  | `current-rules-offline.tap`                          | 205/209 pass; four fixture failures                                        | 53001 | `327358744412b8fb0c51922ad6b63e6d247e81362bb91856941fb7a974e8bc1d` |
| Initial 17-file receipt                | `current-rules-offline-result.json`                  | All 209 observations retained                                              |  1383 | `eb9654107bb15dbb295d61e5a719b255279d792c4dabaa03018486415276f7cb` |
| Immutable 1cc original fixtures        | `premerge-1cc-control/original-fixtures.tap`         | 0/4 pass; same four failures                                               |  5341 | `ecfb362ed718ffdd5e115e30e72ad68a1a9dc94704b47d414ea66dac6ef91cb7` |
| Immutable 1cc first correction         | `premerge-1cc-control/corrected-fixtures.tap`        | 2/4 pass; both retry cases pass; native v6 assumption exposed              |  3527 | `b274a5573e9cee06680dda21e5347a251379575b70430920ad9b024fd6db8523` |
| Immutable 1cc legacy intermediate      | `premerge-1cc-control/corrected-legacy-fixtures.tap` | 0/2 pass; explicitly imported legacy files correctly save native envelopes |  2693 | `ea0ac53e33181326d463cec631a62fb05553756b13b0bc67d4e0636e74378d49` |
| Immutable 1cc final legacy fixtures    | `premerge-1cc-control/final-legacy-fixtures.tap`     | 2/2 pass                                                                   |  1091 | `4df28575fd47c702a3bdedf7aa2f190bc0e9a16e81d3bd99ec8433ec121378c1` |
| Corrected full files and offline suite | `corrected-full-files.tap`                           | 88/88 pass; no skips or cancellations                                      | 21158 | `a4c1ecc96ae32020bc636fc192c672d2b607b22bec624e95faeeb6532a44d6b1` |
| Corrected full-file receipt            | `corrected-full-files-receipt.json`                  | Final test hashes and exact command                                        |  1104 | `95798c4dff935e607636fbca9b7be4c0816609a0ce04740408cda01b006a8450` |
| Immutable source mapping               | `premerge-1cc-control/source-overrides.json`         | 32 runtime MJS paths; original module URLs retained                        |  5490 | `a04e5e9107396b1a4c4e2ead7dd867e4a07ac302b651434a84ecd80ae0553ef7` |
| Original Neon 180s result              | `neon-saved-flights-receipt.json`                    | Timed out; no final correctness result                                     |   594 | `fe949141d91de5c8a5e3c34621c8f3830596e5dd1238304682e680305b470c09` |
| Observed Neon 180s progress            | `neon-saved-flights-observed.log`                    | 145/216 cases completed before timeout                                     | 25591 | `fca5830d76e4a070e9f2e0baab9dd47b5b556a0f83e87e9d8a6f1eae65b83389` |
| Observed Neon 180s receipt             | `neon-observer-receipt.json`                         | Timed out; partial observations retained                                   |   750 | `037160058237661ce6fce147a0ffda429e36064a3173dcdc6fd0b8b0c4743cf1` |
| Original Neon 360s declaration         | `neon-original-360-start.json`                       | Running; no result claimed                                                 |   793 | `29b8519c9772c2351529f9a053db9ff999a833d0a1d37fd69c826526ea548b6c` |
