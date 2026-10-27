# Pause music label language

The shared Versus/Team pause shortcut can retain Ukrainian text after switching to English before the first Pause. Its existing localized binding is created while the button is detached. Global translation intentionally skips detached controls; the normal pause admission previously refreshed availability only.

The correction reuses one stable label producer through the existing localizedText binding in the existing pause refresh callback, immediately before normal admission. It introduces no global translation, early mount, locale subscription, transport, playback, preference or lifecycle owner. The exact native button remains the same; subsequent unchanged refreshes preserve its accepted caption node.

The existing shared owner and translation guard are byte-identical in captured main e7465da3e4b1146b492f401fbb165a5e5a4a6202 and the reviewed Duel feature 27bfa1374531627fa0dad099fc824f84e19abc54, so this is an existing shared-owner issue. Solo's static overlay and the separate mode-play-shell/SIM translation contract are unchanged; no catalog, package closure or generated projection change is required.

Complete component verification: after correcting an initial test's Ukrainian literal against the actual flat catalog key, both new host-prefix cases failed on unchanged production at actual first admission, while both existing cases passed. The corrected production then passed the complete four-case component file. An intermediate test expected the original stale caption text node to survive reassignment; that exceeds the existing localizedText contract. The final case preserves exact native-button identity across first admission, then verifies caption identity across subsequent translations and unchanged refreshes. The complete music-owner and native results are recorded below; full-source, built-package, remaining browser and physical-device gates remain separate.

The first broader run passed the complete component file (4/4) and complete music-owner file (22/22), while the complete new native file passed 1/2 and failed 1/2. Team passed. Versus failed before game or label assertions because the cached i18n module had not mounted language controls into its modeled document, and the test accepted a wrapper div as a language field. The fixture now mounts the actual public attachLanguageControls boot owner through the existing beforeImport callback and requires its actual select element. Production, global helpers and the change-event contract are unchanged. The corrected complete three-file cohort then passed **28/28 cases**, without failures, skips or cancellations:

| Complete file                    | Result       | Boundary                                                                                                                                                                                              |
| -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pause-menu.test.mjs              | 4/4 passed   | Detached first admission, exact button, accepted caption, active/inactive language changes, focus/order, disabled/missing transport, one explicit Next and teardown                                   |
| couch-menu-music.test.mjs        | 22/22 passed | All existing cases plus eight race/coop × playing/paused/muted/unavailable scenarios, retaining exact session, track, queue, master/effects settings, writes and media-play count                     |
| pause-music-locale-host.test.mjs | 2/2 passed   | Actual native Display language events before first Pause, repeated Settings/Back, both paused Duel boards/checkpoint and Team's actual paused hunt/checkpoint; unsupported modeled music stays hidden |

Each complete file ran in a fresh serialized Node 22 worker, with the five-path candidate manifest `24870d17125b243fe171426d7af8203ab6625fddcbb7af5cddd8b13b6d2476b2` identical before and after. Heap/RSS/wall guards did not trigger, logical assertions and timeouts were preserved, and full standard output/error capture was not truncated. This passing run is separate from the earlier failed broader attempt. This final qualification update changes only the new document.

All four authored JavaScript files pass ESLint; all five changed files pass full formatting and diff checks. The original passing run above qualifies the captured e746 source only. The current-main integration and actual Duel/Team browser reviews have separate verification receipts below. Full-source validation, built-package qualification and physical-device checks remain pending. Modeled native/audio cases do not establish audible device output, physical controls or offline behavior.

## Current-main integration

Normal merge `344969679218de783788bef26ff5a7d4db3eec76` first integrated captured main `2d24aee29448667a2cbe0381ef1755529f59fb11`. Normal merge `41870f0d1997624da54059deca4370fc236efc22` then integrated captured main `cdbda99ac881eb9cac62d536543d9078b92ac081`, without rewriting the original qualified history. The original `c127c384bfe00569afccd9b5d0d9498f5933b01d` and intermediate integration remain preserved as named references.

At `41870f0d1997624da54059deca4370fc236efc22`, the entire committed tree matches captured cdb main outside the five original feature paths. All five feature Git blobs match c127 exactly, including the then-current qualification document; the four code/test blobs also match the original passing implementation. The 59 changed main paths retain their exact captured-main blobs. The 64-path Git-OID manifest is `d42efff19741615565f3dc95e369abaadcb453c76d111047e8670fd447187cb6`; 60 present files match their committed blobs, and four unrelated main documentation files remain sparse-absent. No asset fetch, dependency installation, full build or source snapshot was used for integration. The sole missing 924,444-byte generated reaction-runtime text blob was retrieved by its exact Git OID and verified before admission; its main content is unchanged.

The same three complete files were rerun on this frozen integration, separately from the original e746 qualification and earlier failed fixture attempts:

| Complete file                    | Result       | Elapsed  | Sampled peak process-group RSS |
| -------------------------------- | ------------ | -------- | ------------------------------ |
| pause-menu.test.mjs              | 4/4 passed   | 0.322 s  | 46,560 KiB                     |
| couch-menu-music.test.mjs        | 22/22 passed | 1.648 s  | 250,688 KiB                    |
| pause-music-locale-host.test.mjs | 2/2 passed   | 10.606 s | 414,144 KiB                    |

All **28/28 cases passed**, with zero failures, skips, cancellations or todos. Each file ran in a fresh serialized Node 22 worker. The exact head, clean tracked state and five-feature SHA-256 manifest `7f8da5e33bbb1bcfce8b0e31cb0db75252fc04dd008698d7b3e0b2495afb60c8` remained identical before and after every file. The unchanged limits were 1,536 MiB V8 heap, 2,048 MiB process-group RSS and 180 seconds per file, with a 2 GiB disk reserve; no guard triggered and no logical assertion or timeout changed. All standard output was captured unfiltered and without truncation; all three standard-error streams were empty. Changed-file ESLint, formatting and diff checks passed on the integrated source.

This document-only receipt update follows that passing frozen source. It does not claim uninterrupted full-source validation, built-package qualification, physical-device behavior or qualification of main revisions after the exact captured cdb commit. Browser evidence remains scoped to the source and actions explicitly recorded below.

## Original-source Duel browser review

At production commit `7c4dd5205807116b86658cb4c3b641bb5e3d23e0`, the local default Duel page first needed its exact missing First return PNG restored from an already-local, hash-verified donor using one APFS copy-on-write clone. The 2,366,738-byte file matched its tracked Git blob and authored SHA-256; the host remained tracked-clean. This repaired a local sparse-host 404, not production game logic.

Native Retry completed into Ukrainian Home Ready. Native Display → English before the first Pause → Back retained the exact `race-options` focus. Start Race → Escape entered actual Pause with the English **Next song** label, Resume primary focus and **Both players are paused**. Sound off remained set. The review captured `pause-music-7c4-duel-uk-mount-en-first-pause.png` in the dated task evidence directory. Next song was not activated and no audio was listened to. This does not qualify actual Team browser behavior, browser checkpoint bytes, media audibility, physical devices or later-main full-source integration.

## Current-main Duel and Team browser review

Both actual native game families passed the same desktop browser flow at frozen integrated source `41870f0d1997624da54059deca4370fc236efc22`:

| Step                                                                                 | Observed result in both native hosts                                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mount in Ukrainian → native Settings Display → English before the first Pause → Back | The exact Settings opener retained focus: `race-options` for Duel and `coop-settings-open` for Team.                                                                                                            |
| Start → Escape                                                                       | The actual game entered Pause. **Next song** appeared in English, Resume had primary focus, and Sound off remained set. Duel also displayed **Both players are paused**; Team displayed its native pause modal. |
| While paused, native Settings Display → Ukrainian → Back                             | The native pause presentation showed **ПАУЗА** and **Наступна композиція**, with focus restored to the exact Settings opener and Sound off retained.                                                            |

Four screenshots were saved in the dated task evidence directory for 2026-10-19: `pause-music-41870-duel-en-first-pause.png`, `pause-music-41870-duel-uk-retained-pause.png`, `pause-music-41870-team-en-first-pause.png` and `pause-music-41870-team-uk-retained-pause.png`.

This local sparse host needed only its exact missing artwork made available for review. Duel's previously approved First return PNG was restored again after normal merge. Team initially returned 404 for Twin landings; one already-local 2,559,323-byte PNG was restored using an APFS copy-on-write clone, verified against tracked Git blob `828198b3f5beb8051724b81990abf10b53d3488c` and SHA-256 `058e72001734f5ae3351a43e4f686e62090d76d5eaa552a5a78bea0e7a5e6bcc`, then served with HTTP 200. These were local review-fixture availability repairs, without product runtime changes or bulk asset downloads. The four passing code/test blobs stayed exact throughout review.

The browser review did not activate Next song or establish media audibility, exact checkpoint bytes, physical-device controls, installed-package behavior or PWA/offline behavior. Those claims remain separate from the scoped desktop label, language, pause and focus observations above and the 28 complete modeled cases.
