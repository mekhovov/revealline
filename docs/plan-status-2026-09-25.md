# Reveal Line delivery status — 25 September 2026

This is the current player-first delivery plan. It distinguishes public releases from source that
has only reached `main`; a merged pull request is not a delivered game until its exact source is
qualified, frozen, published, admitted to the Pages selector, deployed and played publicly.

## Current boundaries

| Boundary                  | Exact state                                              | Meaning                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public player release     | **v0.116.1**                                             | Current selector and immutable playable release. Steam Deck/controller Confirm uses one activation transaction.                                                                   |
| Accepted source on `main` | **v0.130.0**, `f50a190872a3e63ca1cb1ff6488714d3a23d5db0` | Later features are merged but are not public acceptance evidence.                                                                                                                 |
| Active release blocker    | Core offline distribution is over 64 MiB                 | The first v0.130 freeze measured 75,358,267 bytes. The source gates passed; snapshot creation failed.                                                                             |
| Test policy               | Long automated suites temporarily waived                 | Validation, lint, formatting, production provenance, exact-source, build, frozen-asset, archive and public checks remain required. Waived tests must never be reported as passed. |

## Publicly completed player work

- **Default Journey and unified mission library:** ordinary Solo, Versus and Team entry exposes the
  current journeys while retaining explicit Legacy access.
- **Loading, sound and appearance foundations:** asynchronous preparation reports state; global
  Settings and quick sound controls exist; FPV Field Kit presentation and Ukrainian palette
  foundations are public.
- **Cross-mode map presentation:** Team artwork, exact picture authority and readable actors are
  public through v0.110.1. Existing Solo, Versus and Team content share the accepted presentation
  pipeline, subject to the remaining full-inventory qualification below.
- **Compact Home and Pause:** v0.105 introduced compact Home/More; v0.107 introduced one focused
  Pause menu; v0.115.0 publicly unified the player shell and v0.115.1 corrected Missions/Steam Deck
  entry behavior.
- **Player input baseline:** keyboard, touch and modeled-controller paths have focused evidence.
  v0.108.0, v0.111.1 and v0.116.1 fixed controller/Steam Deck activation defects. This does not
  replace physical-device qualification.
- **Character cleanup and Couch quick start:** v0.112.0 removed the unwanted FPV corner locator
  marks and reduced Couch setup friction.
- **Journey rewards:** v0.116.0 retains the exact accepted Journey picture and makes earned Solo
  rewards visible in Collection; v0.116.1 is the accepted public successor.

## Merged source awaiting one public consolidation release

The repository advanced from v0.116.1 to v0.130.0 without publishing each intermediate source
version. The next public release therefore qualifies the combined exact v0.130 tree; the entries
below are source-complete but remain **undelivered** until that release passes.

| Source milestone | Merged result                                                | Remaining gate                                                                          |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| v0.117           | Shared skins for Ukrainian actor-review surfaces             | Included in v0.130 freeze/public visual check                                           |
| v0.118           | Reviewed Team specialist library                             | Included in v0.130 Team library and play check                                          |
| v0.124           | Creator campaign framework                                   | Included in build/provenance and supporting-workflow checks                             |
| v0.125           | Quick music controls across modes                            | Actual playback/listening and public control checks                                     |
| v0.126–v0.127    | Soundtrack admission plus bundled Shchedryk opening          | Offline budget, byte identity, gesture recovery and audible review                      |
| v0.128–v0.129    | Journey spatial and readable-pressure candidate sets         | Availability, route integrity and public player-entry checks                            |
| v0.130           | Ukrainian ornament studies and Steam Deck Confirm correction | Offline-budget repair, exact-source qualification, freeze, release and Pages acceptance |

The proposed budget repair keeps `homeward-skies.json` hosted and installable while excluding its
11,371,849 bytes from automatic core precache. The expected core is about 63,986,418 bytes before
generated metadata. Production build output is authoritative.

## Remaining player-first programme and ETA

Ranges start after the preceding public release is accepted. They include ordinary engineering and
release work but exclude unpredictable GitHub runner or archive-storage delays.

| Priority | Item                                       | Remaining acceptance                                                                                                                                                                               |                     Working ETA |
| -------: | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------: |
|        1 | **Publish v0.130.0 consolidation**         | Repair offline budget; repeat exact-source qualification/freeze; inspect assets; publish; archive v0.116.1; admit selector; deploy; verify public bytes and Solo/Versus/Team play                  |                  **4–10 hours** |
|        2 | **UX1-B compact grouped mission gallery**  | Campaign groups, compact responsive cards, exact selection/scroll restoration, one-action Play or Download & play, lazy map/art previews, spatial keyboard/controller navigation and touch targets |                    **1–2 days** |
|        3 | **UX3 gameplay layout and teaching**       | One-row short-landscape HUD, maximum board area, shared touch geometry, objective-first Team HUD, contextual first-play hints and reduced-effects parity                                           |      **1–2 days plus hardware** |
|        4 | **UX4 start, failure and continuation**    | 3-2-1-Go without pre-Go simulation, 600 ms Retry cue, deliberate terminal failure panel, named Next destinations, campaign endings and duplicate-award proof                                       |                    **1–2 days** |
|        5 | **UX5 remaining player screens**           | Settings/difficulty, Help, Collection/Records/replay, unavailable-content recovery and exact return focus; ordinary play must not require Workshop or a file picker                                |                    **1–2 days** |
|        6 | **UX6 whole-player qualification**         | End-to-end journeys across modes/content sources; accessibility, performance, storage, offline, browser lifecycle, mixed input and real-device evidence                                            |       **2–4 days plus devices** |
|        7 | **P08 map/actor/action closure**           | Full 15-map Versus inventory, both Team arenas/imports, complete role assets, warnings, hit/recovery and reduced-effects readability                                                               |     **2–4 days plus playtests** |
|        8 | **P02/P05 audio and theme closure**        | One audio authority, complete theme compatibility/restoration, soundtrack transfer/offline behavior and listening review                                                                           |                    **2–4 days** |
|        9 | **P04/P17 Studio and community authoring** | Cross-mode previews, editor/history/bundle round trips and an independent fresh-workspace create/install/play/recover trial                                                                        |                    **4–7 days** |
|       10 | **P09/P10 encounters and difficulty**      | Gentle/Standard/Hard, deterministic optional encounters, fair counterplay and the 36-case Team matrix                                                                                              |     **3–6 days plus playtests** |
|       11 | **P11–P15 campaign production**            | FPV, DroneAid, Living Atlas, Retro and Coupa slices, each with design cards, reviewed art and independent public releases                                                                          | **3–7 days per accepted slice** |

## Immediate implementation order

1. Finish the v0.130 offline-budget correction without changing mission identity, installed content,
   earned rewards or hosted bytes.
2. Qualify and publish that exact source through the existing immutable-release and Pages pipeline.
3. Build UX1-B as the next independent player release. Do not mix the gallery with broad
   localization, creator/admin or campaign-production changes.
4. Continue UX3, UX4, UX5 and UX6 as separate reviewable releases.
5. Close presentation, audio, Studio, encounter and campaign-production work after the main player
   journeys are reliable.

The broad English/Ukrainian localization draft targets v0.131.0 but currently conflicts with
`main`, touches hundreds of files and inherits the offline-budget constraint. It remains a draft
until rebased, its uncatalogued-string audit is resolved and its live-switch/browser/device checks
pass. It must not displace the smaller player-flow releases merely because the version was
provisionally reserved.

## Blockers and concerns

1. **Offline capacity:** v0.130 cannot freeze until its automatic core cache is below 64 MiB and
   every excluded item still has a clear online/install/offline contract.
2. **Public/source drift:** public v0.116.1 is thirteen source milestones behind `main`; every public
   claim must continue to name the boundary it describes.
3. **Temporary test waiver:** long suites are skipped by committed policy. Focused regression tests
   and the mandatory source/build/provenance/public gates carry more risk than a restored full
   matrix. Restore full CI before final UX6 qualification.
4. **Physical hardware:** modeled controller and browser-pointer checks do not certify Steam Deck,
   DualSense, iPhone or tablet behavior.
5. **Human quality:** difficulty fairness, addictive pacing, cultural accuracy, actor readability
   and soundtrack quality need play/listening review.
6. **Large stale draft queue:** old stacked feature PRs conflict with current `main`. Reconcile only
   related hunks into fresh feature branches; do not bulk merge or reuse stale version metadata.
7. **Release serialization:** one publisher must own tags, frozen assets, archives and Pages. Feature
   implementation may proceed in isolated worktrees, but public promotion remains sequential.

## Completion rule

Every player-facing item follows:

**rebase latest accepted `main` → implement/review related hunks → focused tests and browser proof →
versioned PR → protected merge → exact-source qualification → immutable freeze/release → predecessor
archive → Pages selector/deploy → public bytes and scoped play verification → status update.**

A branch, passing focused test, merged PR, tag, uploaded artifact or successful deployment is an
intermediate state. “Complete” means the public version was verified, with physical-device and
human-review limitations stated separately.
