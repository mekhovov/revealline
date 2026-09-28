# RevealLine — next-batch delivery checkpoint

28 September 2026. This is a dated audit and source-work checkpoint. The coordinator remains authoritative for the changing release queue; historical source reports do not become public acceptance.

## Completed / delivered

- **Public v0.141.7** remains selected. The retained byte audit reports 2,223 files / 757,762,788 bytes and zero final failures; this turn does not rerun it. [Play](https://mekhovov.github.io/revealline/releases/v0.141.7/site/game/).
- **Original P00, P01, P02-A:** accepted within their historical integration, loading and master-sound scopes. New surfaces and regressions retain separate gates.
- **Main advanced to `bb9b3640270dc26633d37cfdf4a306aecda277b6`:** #741 synchronizes terminal-defeat preparation tests; #750 fixes neutral commands in the Versus pilot and verifies pilot recordings with real engines. The #750 record reports 38 focused checks and a short desktop smoke. Full replacement-pilot runs, alternative routes, difficulty review and download acceptance remain. Neither merge publishes new game bytes.
- Shared steering/capture-stop, both turning modes, line impacts, saves/scores/Collection, playlists, packs and couch foundations remain implemented. Their full mode/device qualifications are unfinished.

## Source-complete / queued, not released

- **#746:** coordinator integration of eight frozen inputs (#716, #722–#724, #726–#729). At audit its public PR head is `1267bf01305016a5301c1beeea193f8511638b00`; the coordinator is reconciling newer main and reviewing further inputs. Do not treat that mutable queue description as a frozen new release.
- **#742:** paused Flight Details locale refresh, 69 scoped checks.
- **#748:** keyboard-remapping and earlier-release transfer locale refresh, 78 scoped checks. Hosted preflight/candidate/reconcile pass; release readiness is held because no release slot is allocated. Full tests/build are skipped, not passed.
- **#749:** open release-evidence documentation for v0.141.7. Its bounded browser record excludes gameplay, downloads, persistence, listening and offline readiness; its passing evidence gate must not imply those checks passed.
- **This batch:** cold-Ukrainian Settings Home/End navigation correction and regression evidence. [Behavior and maintenance prompt](settings-native-key-navigation.md). Source-only until accepted by the release coordinator.

## Next independent implementation item

P03/P05/P16: reproduce and fix the complete-backup replacement review in Library. Its Keep/Replace labels and Undo explanation currently capture translated strings before the player changes language. Refresh only display text from the reviewed snapshot; never repeat preparation, replacement, source reads or focus changes. This is a source-audit finding, not a tested fix. Confirm ownership and reproduce the actual pending-review path before implementation.

## Remaining phases in priority order

| Priority | Phase                      | Remaining acceptance                                                                                                                                                                     |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Current delivery           | Finish exact combined-source review/checks, allocate one version, protected merge/freeze, Pages delivery, complete byte audit and affected public journeys                               |
| 2        | P03/P05/P16                | Complete consistent navigation, readable/localized status, touch/controller and recovery journeys; integrate ready small fixes without enlarging reviewed batches implicitly             |
| 3        | P02-B                      | Qualify custom/mixed music in every advertised mode, actual listening, transfer, offline and interruptions                                                                               |
| 4        | P07/P08-A/B                | Finish Retry/Next/reward stories, actual-size actor parity and readable capture/loss/Support/pickup feedback                                                                             |
| 5        | P09/P10                    | Tune fair pressure, warnings/counters, Team rescue/shared encounters and compatible deterministic behavior                                                                               |
| 6        | P04/P06                    | Demonstrate complete create/edit/export/import/play and install/replace/remove/recovery with exact original bytes                                                                        |
| 7        | Current Journey production | Reconcile accepted thematic content with the approved current edition; finish remaining art, encounters, actors, stories and sound across FPV, DroneAid, Ukraine, retro and spend themes |
| 8        | P16/P17                    | Complete scores/replay/learning/legacy recovery and an independent fresh-workspace author/install/play/export/recover example                                                            |
| 9        | P18                        | Complete cross-phase performance/accessibility/media/offline regression, real touch/controllers and human challenge/replay assessment                                                    |
| Later    | Native stores / network    | Separate platform packaging/signing/lifecycle and authoritative network/reconnect acceptance                                                                                             |

The original P11–P15 numeric campaign allocations and **132 missions are superseded** by the approved Xposed Journey programme. Preserve thematic quality/provenance/compatibility requirements, not obsolete quotas. Candidate counts and exposed menu counts do not establish completed production.

## Queue concerns and ETA

The next release is awaiting coordinator-owned integration, exact-source qualification and public acceptance. There is no reliable public date until these gates close. The independent Settings correction is a small source batch; its source readiness does not imply a release ETA. Larger content/device phases need their inventory and real-player/hardware evidence before calendar estimates can be credible.

Keep source PRs small and complete, retain prior reviews and immutable releases, and combine only compatible reviewed inputs. Local disk remains constrained; use bounded existing Git objects and dependencies, not full installs/checkouts or media downloads. The temporary long-suite/build waiver remains explicitly skipped. Do not silently infer a pending optional-download choice or overwrite browser storage. Device models, DOM fixtures, browser components, real gameplay, listening and physical hardware are separate evidence categories.

Each released item still requires source/PR, allocated version, public URL, passed checks and remaining limitations before its phase can be marked complete.
