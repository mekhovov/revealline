# Academy terminal result language

Changing language after a timed-out Academy flight replaced “Flight ended” and retry advice with the ordinary course title and lesson. An unscored draft test similarly lost its “Draft test finished” and no-recording explanation. The original terminal handler selected the correct meaning, but the later language painter unconditionally restored normal course copy.

The correction shares one local result-copy painter between the existing language refresh and terminal handler. It derives special wording only from `!replay && terminalHandled` and the actual flight's terminal snapshot, preserving tuning-first precedence and the exact existing English/Ukrainian strings. Ordinary success keeps the current course's title and lesson. Playback presentation and a reset or hidden result do not inherit an earlier live outcome.

There is no new stored outcome owner, result admission, proof export, locale listener, focus operation or input policy. The existing language handler still pauses and cancels the existing continuous-play transition. The existing completion handler still owns proof, scoring, visibility and action focus. The painter changes only the result heading and advice text.

## Source scope

The branch starts directly from captured main `cdbda99ac881eb9cac62d536543d9078b92ac081`, independently of the pause-music fix. Only these three paths belong to this change:

- `optional-practice/civilian-fpv/app.mjs`
- `game/test/fpv-flight-ui.test.mjs`
- This qualification document

The passing source pair has manifest `71ac02d0340566f6a3525573fbdb6eeafb06ea579f491c56e0b2d6777744980e`, computed from each ordered path, a NUL separator, its SHA-256 and a newline:

| Source                    | Git blob                                   | SHA-256                                                            |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Academy app               | `d4d977c30e7eb2f47f31db3cfd624c0586812d08` | `f72997478a3520aced5e5e23db3c737e896da0314e0b61be7f7c28350fe41768` |
| Complete native test file | `37ccc4c9f9e680ffd876de0935596dae5f2c4a3d` | `bd36de2a8c61c057e40b85adba07510ad1a00ddab5f0e1148e983df1cf79b348` |

## Verification and failed attempts

| Attempt                                                                                                              | Exact boundary                                                      | Result                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid unchanged-production red, manifest `d04debf0fa6eedc70f89cc44a4f7022f4bdbe2313689c93e457ba5743318dbd4`          | Two selected new native cases, production app exactly captured cdb  | Both failed at the expected Ukrainian result-title assertion. The real expired flight had reached all 36,000 model ticks; the real unscored public-course objective had completed. Actual “Підйом і посадка” incorrectly replaced “Політ завершено” or “Перевірку чернетки завершено”. This is selected-case evidence, not a complete-file run. |
| First complete corrected-production run, manifest `44c73db1b5cbb4f69ef49abeeaf9af941e602074935bb301763a1e1ad6f1903a` | Entire native file, including the new controls                      | 75/78 passed. All existing cases passed. The three new cases passed their semantic assertions, then failed a new Back-focus assertion: the fixture had activated the Settings button inside a closed Home dialog. This is a failed complete run, not qualification of the later controls.                                                       |
| Corrected public-menu route, manifest `71ac02d0340566f6a3525573fbdb6eeafb06ea579f491c56e0b2d6777744980e`             | Entire native file, with all original cases and the three new cases | **78/78 passed**: 74 top-level cases and four nested cases, with zero failures, skips, cancellations or todos.                                                                                                                                                                                                                                  |

The fixture correction opens Home through the actual toolbar Menu, verifies the Home dialog and visible Settings opener, and then uses native Display, its actual language select and Back. The strict exact-opener focus assertion remains. Production bytes and its predicates did not change between the two complete runs.

The final complete run took 33.265 seconds with sampled peak process-group RSS of 1,055,728 KiB. It used Node 22 with a 1,536 MiB V8 heap, 2,048 MiB process-group RSS, 180-second wall limit and 2 GiB disk reserve. No guard triggered; logical assertions and timeouts were not relaxed. The head, source pair and expected tracked diff stayed identical before and after the run. The complete unfiltered stdout was 19,218 bytes, SHA-256 `fafbc2d080b3aee29371279b73dce77fa747fede7e625de6f5a9169ae4189c2c`; stderr was empty and capture was not truncated.

The separate red run took 25.395 seconds, with no guard and full 2,752-byte stdout capture (`62f11ef9f944091259ab4e11322f2e5288289e42e99fd6e631d817e783858a36`). The first failed complete run took 32.482 seconds, with no guard and full 21,775-byte stdout capture (`cea0252fd73e567172f08fa6ca065b8e9efdfade55bfdb703a577674d69dc4df`). Both had empty stderr. These results remain separate from the final pass.

## Meaningful control boundaries

- Actual normal-frame expiry retains terminal wording through English → Ukrainian → English. The fixed 36,000-tick model limit is unchanged; the public renderer option retains only its latest draw instead of the fixture's full draw history.
- An actual unscored draft test reaches a valid public-course landing objective, keeps its no-recording explanation and cannot export proof or admit a scored result.
- A four-frame unfinished recording reaches presentation EOF while the retained live flight remains expired. Locale changes preserve the recording's exact unfinished model state and hidden live result, without borrowing the live terminal meaning or granting objective completion.
- A real authored USB demonstration drives normal practice to one verified completion. Locale changes retain normal course copy, proof and the single admission.
- Reset after each result stays disarmed with zero ticks and a hidden result. Translation restores ordinary course copy without reviving the old terminal presentation.
- Native node identity, action visibility, focused language field, exact visible Settings opener on Back, model state, retained proof, record bytes, storage-write counts, delivery count and download count are preserved across the tested locale changes.

Both JavaScript files pass parsing and ESLint; the complete native test file and this document pass formatting, and the source diff passes whitespace checks. The new painter independently matches Prettier. The captured baseline app and candidate both retain existing whole-file formatting debt; no full-app formatting pass is claimed and unrelated formatting was not changed.

Actual browser review of these terminal flows, uninterrupted full-source validation, built-package qualification and physical-device checks remain pending. Modeled native tests do not establish audible media, physical USB controls, installed PWA/offline behavior or qualification of later main revisions. No asset hydration, package build or source snapshot was used.
