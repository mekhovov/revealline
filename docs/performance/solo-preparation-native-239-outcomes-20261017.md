# Preparation and layout observations at tooling 239

The twelve-row run [39049194995](https://github.com/mekhovov/revealline/actions/runs/39049194995) completed with **seven original correctness passes and five failures**. Both jobs failed overall. These are excluded diagnostics, not three-pair performance qualification or physical-device evidence. The observed game is the exact **e1cc/118 package**, artifact 12104590541; tooling is239c574ecddd5bb6d5896e621d9edc53e7f6a313. Later replay/save changes are not attributed to this package.

Both jobs admitted the full package, inner archive, source and CSP before their rows. All eighteen setup/row command owners closed without forced cleanup, ambiguity or survivors. Chromium used 1280×800/DPR1 desktop settings; Linux Playwright WebKit used 400×850/DPR3 mobile-touch settings. These are different raster/input profiles, not a controlled engine comparison. WebKit's retained process paths identify its WPE MiniBrowser port; no physical iPhone or GPU-backend inference follows.

| Case                     | Chromium                                                                                                    | WebKit                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Cold first30             | Correctness and geometry pass; raw observed-window pass; strict native replay pass                          | Geometry acknowledgment passes, then real active hitch/pause at tick 0; scenario fails, no replay           |
| Warm Resume              | Correctness and geometry pass; native replay pass; numeric inconclusive                                     | Public no-open-dialog/Start predicate times out before Resume; prior-segment replay passes only             |
| Saved Resume             | Correctness and geometry pass; two-document journal and native replay pass; numeric inconclusive            | Correctness and geometry pass; two-document journal and native replay pass; raw review-required             |
| Selected-font Cancel     | V3 behavior and replay pass, but original row fails missing journal metadata; corrected-reader result below | Post-command Cancel observed, but exact font faces are unloaded/error; release and later Start withheld     |
| Required-original Cancel | Correctness and replay pass; numeric inconclusive                                                           | Fetch abort observed, but observer failed to latch the earlier submitted run; checkpoint proof and row fail |
| Optional-icon404         | Correctness and replay pass; numeric inconclusive                                                           | Correctness and replay pass; raw review-required                                                            |

Nine raw reports contain a passing strict native replay. One is WebKit warm's segment **before** its failed Resume route, so this is not nine completed workloads. Chromium cold and WebKit saved Resume retain their separate Node portability mismatch. No original numerical result was promoted.

## Accepted preparation and resumed clocks

Five of six geometry rows acknowledge positive matching actual/cached canvas dimensions, accepted preparation revision, same prepared/submitted run and a cleared preparation marker. Chromium records 1138×568; WebKit records 376×188. These prove application acknowledgment at the phase boundary, not physical display completion. WebKit warm never reaches its resumed boundary.

Chromium cold starts with zero quiet samples and reaches first running at tick 0 after 30 samples, B = 16.7 ms. Chromium warm resumes the same run at paused tick 151, then records 55 ticks over 494.9 ms; saved Resume restores tick 153 and records 54 ticks over 490.2 ms. WebKit saved Resume restores tick 160, completes its 30-sample B = 16 ms calibration and records 56 ticks over 693 ms. Saved observations fit the original 3+3 record aggregate and preserve both journal documents. Resumed commands have no fresh discrete edges; continuous left direction is legitimately retained.

WebKit cold likewise reaches first running at tick 0 only after 30 samples, B = 16 ms, with matching geometry. It then records a fully active 259 ms callback interval (page 19106→19365ms) and 228 ms measured app-work window (19366→19594 ms), followed by a pause at tick 0. Its later public Pause action times out because the button is hidden. The preparation acknowledgment does not erase this real loaded-play failure. Measured app work includes synchronous Phaser submission; asynchronous raster/compositor work remains unobserved.

## Font cancellation: observation correction and unresolved loading

Chromium's early callback record is busy/defaultPrevented:false at 8720.4 ms. The actual post-command record at 8733.6 ms is cancelled/defaultPrevented:true, same run/tick 0, with the exact 600-weight faces loading. After the verified original response is forwarded, the game remains cancelled at tick 0 with loaded faces; explicit Start later reaches running and its native replay matches. This directly distinguishes the early callback record from the completed native Escape command.

The original row nevertheless fails because the qualifier omitted `readinessPilot.cancelBoundaryObservation`, which the unchanged strict journal reader requires. A **separate corrected-reader analysis** derives `post-command-v3` from the executed declaration, retained V3 protocol and actual completed-command record. It runs the exact 239 reader on the original 101-record/2,424-byte binary: original missing metadata reproduces invalid-evidence; the derived field yields a complete journal and correctness pass, with numeric status still inconclusive. Only local sidecar paths are mapped for readback. Original report bytes, failed row and workflow conclusion remain unchanged. This is an eighth behavior supported by corrected analysis, not an eighth original pass or a new native observation.

WebKit's post-command record similarly shows cancelled/defaultPrevented:true at 19199 ms, same run/tick 0. Its independent font prerequisite fails: both matching family/600 faces are already `unloaded` and `error` at Start and remain so at Cancel, despite `FontFaceSet.check()` returning true. The transport verified one 38,120-byte original response and held two exact same-URL requests; it never forwarded that response. On failure both routes aborted and the response was disposed, with zero pending/owned operations afterward. The original loading failure remains unresolved.

Exact e1cc CSS declares `Field Kit Display`, normal weight 600, `font-display: swap`, the expected Handjet URL and no unicode-range restriction. Theme preparation awaits the stylesheet and loads each resolved role with its declared weight. The retained inventory lacks per-face URL/style/stretch/unicodeRange and font-request rejection details; it cannot distinguish the two native font objects or establish why one errored. A true `check()` is not substituted for exact loaded-face evidence.

## Other failure boundaries

WebKit required-image cancellation records one matched request, the actual native AbortSignal and an AbortError rejection. Its checkpoint observer first attempts to latch the submitted run inside Escape, after preparation has invalidated the painter's `lastPaint`; it reports “Ambiguous or missing submitted run.” Earlier trusted Start still has the submitted first-return tick 0 run. This is a demonstrated observer boundary defect, not proof that the application ignored Cancel. A proposed future reader latches that exact earlier reference and must still reject missing/replaced/active runs and require later same-run submission.

WebKit warm completes initial play, Pause and export, but fails the no-open-dialog/Start predicate after public menu closure. The raw report does not identify the remaining dialog. Its earlier replay remains valid only for the exported initial segment. No route waiver or automatic rerun is implied.

## Retained authority

Raw archives are retained ZIP-only under `.cache/solo-followup/final-native-239c/readiness/`. Every member was read back with CRC, size and SHA256 checks; independent analysis reuses exact executed239 assessment code and decodes all retained journal binaries.

| Artifact             | ZIP bytes | SHA256                                                             | Members |
| -------------------- | --------: | ------------------------------------------------------------------ | ------: |
| Chromium 12106614808 |   577,967 | `64b35846281c57b96d327763dd18fa529efcf79b1510645af0b8917cac86ebe1` |      58 |
| WebKit 12107311023   |   480,499 | `fbf87bf19020d6c144c1384ad0637ed86613433a8f5599117823b5342b06eed8` |      55 |

`chromium-analysis.json` is 482,811 bytes / SHA `a02cb26fd53b9ecd72fac1ed9c83f41052e71c7a035b2c109fee269c462e4d24`; `webkit-analysis.json` is 340,264 bytes / SHA `84ecd5b2f75b5026bc5e0c00a2640fa817bb1823b8680badcca3dce36147d4b7`. The separate `corrected-reader/analysis.json` is 4,029 bytes / SHA `68def3884b3e283683352ef2a4c9247dabb5ac588cf55f22cff75fa4a59a071d`. Source-level follow-ups and corrected analysis do not reassign these observations to a later package.
