# RevealLine — completed, queued and remaining work

Checkpoint: 28 September 2026. This is a bounded source-work report, not a new release acceptance. It complements the authoritative release coordinator and [cross-mode execution register](cross-mode-execution.md); historical reports retain their recorded dates.

## Released / completed within their accepted scope

- Public baseline: [v0.141.7](https://mekhovov.github.io/revealline/releases/v0.141.7/site/game/), frozen source `efbb3882b4edd447c8e9f60ed60c536a956d78f3`. Retained release evidence reports 2,223 deployed files / 757,762,788 bytes with zero final failures. This batch did not rerun that inventory.
- Main baseline used here: `c5885a15561a88331c5566c5312392c4e5d8daf5`. It includes the Steam Deck host-test timing correction and company evidence records; neither constitutes a newer runtime release.
- Original P00 integration, P01 loading feedback and P02-A master sound authority have scoped acceptance at v0.55, v0.57.4 and v0.58.1 respectively. Later regressions and new surfaces still need their own checks.
- Existing foundations include continuous steering, authored capture-stop, two turning policies, travelling line impacts, shared touch steering, saves/scores/Collection, playlists, packs, and Solo/Versus/Team. This list is not full-device or whole-phase certification.

## Implemented and queued — not deployed

[Draft integration PR #746](https://github.com/mekhovov/revealline/pull/746) combines eight frozen inputs (#716, #722–#724, #726–#729) at `1267bf01305016a5301c1beeea193f8511638b00`. It includes soundtrack URL handling, FPV failure feedback, touch outside-release recovery, offline/replay localization, an optional cultural-pressure route, acceptance tooling and ownership/offline measurement. It is unversioned and remains under combined-source review. Its admission hold is not permission to bypass release readiness.

[Draft PR #742](https://github.com/mekhovov/revealline/pull/742) fixes live-language updates in paused Flight Details. Its 69 focused checks, catalog reproduction, lint and formatting are source evidence. It is a later-batch input, not part of #746.

This separate **Settings and recovery localization** batch fixes:

1. Keyboard labels, accessible names and capture/status instructions when switching EN/UA. Capture, focus, stored bindings and pending paused movement remain owned by the existing controls.
2. Earlier-release save-transfer source labels, reviewed summaries, loading/cancel/copy feedback and Undo instructions. Translation never rereads the source, repeats a copy, alters selection, changes reviewed facts or rewrites saved bytes.

See [scoped evidence](verification/settings-recovery-locale-20260928/README.md). This batch has no new campaign, gameplay rule, storage format, version allocation or release.

Other open inputs include Remix/terrain pressure, gallery deduplication, company and lesson localization, company inventory/qualification and deployed community checks. They require coordinator selection and dependency review; open PR count is not a count of completed features.

## Remaining execution order

| Priority | Phase / batch                                    | Remaining deliverable                                                                                                                                                          | Estimate basis                                                                              |
| -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1        | Current release batch                            | Complete #746 combined-source review and required checks; allocate one version; protected merge; freeze; deploy main Pages; audit bytes and affected public journeys           | Release date pending coordinator gates; no reliable wall-clock ETA yet                      |
| 2        | P03/P05/P16 player consistency                   | Integrate ready navigation/localization/recovery fixes in compatible small batches; verify focus, explicit Resume, touch and controller journeys across advertised modes       | One bounded batch at a time; source-complete work still needs integration/public acceptance |
| 3        | P02-B music                                      | Qualify custom/mixed playlists in every mode, actual media transfer, listening, offline and interruption recovery                                                              | Depends on soundtrack integration and actual audible/offline evidence                       |
| 4        | P08-A/B presentation and P07 rewards             | Finish actual-size actor/heading parity, event readability, Support/rescue and loss effects, full-picture/story rewards and reliable Retry/Next                                | Asset cohorts plus per-mode player journeys; do not infer completeness from body images     |
| 5        | P09 challenge / P10 Team                         | Tune fair pressure, warning/counterplay, authored encounters, Team rescue/shared goals and deterministic compatibility                                                         | Human balance assessment and mode-specific evidence remain                                  |
| 6        | P04/P06 creation and installation                | Demonstrate real create/edit/export/import/play; compatible catalog/install/replace/remove; original-byte backup and interrupted-operation recovery                            | Depends on accepted storage/content inventory and complete authoring journeys               |
| 7        | Current Xposed Journey thematic production       | Reconcile accepted maps/art/stories/music with current approved edition inventory; finish missing FPV, DroneAid, Ukrainian, retro and spend-management presentation/encounters | Inventory-based scope; bulk production follows gameplay/pipeline quality gates              |
| 8        | P16/P17 supporting workflows and reproducibility | Finish Collection, scores, replay, learning, recovery and legacy paths; independent fresh-workspace author/install/play/export/recover example                                 | Requires independent execution, not just prompts or scripts                                 |
| 9        | P18 browser qualification                        | Cross-phase regressions, performance/memory, accessibility, real phone/controller play, media/offline recovery and human challenge/replay assessment                           | Physical hardware and human evidence cannot be replaced by DOM simulation                   |
| Later    | Native stores / online multiplayer               | Platform lifecycle/signing/store qualification; separately authoritative network sessions/reconnect                                                                            | Deferred outside the browser-release sequence                                               |

These are dependency estimates, not promised completion dates. A calendar ETA for all remaining phases would be unreliable before the current release gate and content inventory close. Report each accepted batch with its exact source, public version, checks and remaining limitations.

## Important correction to older reports

The original **132 new Solo missions** and four-FPV/four-DroneAid campaign allocation were superseded by the approved 20 September [Xposed Journey plan](xposed-journey-plan.md). Original P11–P15 remain thematic-production history, not unfulfilled numeric quotas. Retain their quality, compatibility and provenance requirements; assess completion against the current approved edition inventory. Dated candidate counts are authoring backlog, not delivered content or a fixed release minimum. Publicly exposed mission counts and company source counts alone do not establish accepted campaign production.

This corrects the stale interpretation in the earlier Flight Details status note without rewriting that reviewed branch or its historical evidence.

## Concerns and release discipline

- One release coordinator owns merge, version allocation, freezing, selector and Pages publication. Follow-up PRs do not enlarge its reviewed aggregate automatically.
- New PRs change overlapping locale catalogs. Union intended source keys and regenerate the catalog at integration; never choose one generated blob over another without checking source equality.
- Local disk space is constrained. This batch uses existing dependencies and bounded existing Git objects; no install, full checkout, full build or media download.
- Full-suite/build waivers remain **skipped/not run**, never passed. Finite DOM tests are not browser rendering, screen-reader listening, physical input or deployed-game acceptance.
- Previous-public offline acceptance has a specific optional-download choice pending in its owning workflow. This batch does not infer approval, install optional media, reset browser data or claim that acceptance.
- A merged PR, successful preflight or uploaded artifact alone does not complete a phase. Require immutable version, successful Pages delivery, byte audit and affected public journeys. Preserve the prior public release and rollback route.

## Research applied to this batch

Keep status associated with its action and update it without moving focus, following [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). Keep language changes predictable and free of repeated operations or unexpected context changes, following [W3C on-input guidance](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html). These sources guide implementation; they do not certify accessibility compliance.
