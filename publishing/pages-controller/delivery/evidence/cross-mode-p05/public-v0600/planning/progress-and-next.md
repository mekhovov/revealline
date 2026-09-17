# RevealLine — v0.60 progress and remaining work

**v0.60.0 is deployed and accepted for the listed Studio/Replay scope.** [Play v0.60.0](https://mekhovov.github.io/revealline/releases/v0.60.0/site/game/). This dated delivery snapshot uses main `0d1f8a281a3c01768e69ac7a7de05094d03f0ee7` on 17 September 2026. The approved P00–P18 scope and phase IDs remain unchanged. **Full P05 remains incomplete.** See the [scoped delivery record](../README.md) for the exact evidence and limits.

## This release: Studio and Replay readability

The v0.60 source delivers a named part of **P05**, not the whole phase:

- **Shared interface settings:** Studio and Replay use the game's Theme/Plain text, Standard/Large size and effective reduced-effects preference. A system motion request can reduce effects without rewriting the player's saved choice.
- **Dependable preference return:** persisted page return rereads the shared settings and system request; an unsaved local choice and its warning remain authoritative. Reading settings never silently saves them or resumes play.
- **Studio inspection and editing:** interface changes preserve the selected asset, prepared original bytes, dirty edits, Undo/Redo and audio ownership. Font specimens use the selected file and appropriate weights, including English and Ukrainian examples. Inventory replacement preserves keyboard ownership; narrow layouts retain the Inspector handoff.
- **Studio animation:** only the preview's owned frames react to the effective motion limit. Removing that limit resumes a locally Playing preview with a fresh clock; a locally Paused or Reduced preview stays still.
- **Replay navigation:** display controls work before content loads and after startup failure. Jump to playback hands focus to a usable transport action only while it still owns the user's intent. At completion, focused Play/Step moves to Restart without stealing unrelated focus. A terminal exit fences late startup work.

These changes preserve gameplay, arena geometry, replay identity, playback position, verification, scores and saved-progress authority. They do not add campaign art or complete the creation framework.

Frozen source `170508f11dd41204b7e24917a823f21701c15961`, tree `287ea0fddf97f594af0ce9eba452a24dc5f507c7`, passed both complete hosted source families at **5,399 tests each**. Those are two independent runs, not an additive test count. Source [PR #78](https://github.com/mekhovov/revealline/pull/78) and publication [PR #79](https://github.com/mekhovov/revealline/pull/79) are merged. Root's separate qualification records contain the source gates and build evidence; this report does not rerun them.

| Final public gate | Current status |
| --- | --- |
| Pages publication | Deployed from main `0d1f8a281a3c01768e69ac7a7de05094d03f0ee7`, run `35196541650`, deployment `6498129383`. |
| Complete actual public-byte audit and authority reconciliation | **Pass:** all **2,649 files / 638,838,205 bytes** verified; zero failed, skipped or uninspected files. One failed HTTP attempt and its successful retry are retained. Every result row was reconciled; the fresh authority check passed at **08:01:35 UTC**. [Full report](../tools/runs/complete-1/report.json). |
| Affected actual public journeys and final scoped native acceptance | **Pass for the listed scope:** actual Studio/Replay keyboard, shared-preference and focus journeys; current selector and retained v0.59.1 startup/return route. [Original observations and limits](../native/observations.md). |

Actual public Studio observations include keyboard selection of all three original font specimens and a Plain/Large interface while preserving specimens and the workspace. Replay was reached by keyboard through Workshop, inherited Plain/Large, and Jump focused Play. It played and paused at tick 512 of 1,305; restoring Theme/Standard with Reduced effects off preserved that exact position. Completion reached tick 1,305 with checkpoint `861a6de2ffd7e119`, 74.1% coverage, three lives and 12,590 **recorded** points, granted no awards, and focused Restart. Keyboard Return reached the game Start screen. The release selector’s actual v0.59.1 link also reached Archive 15 and loaded its title with Start focused; browser Back and the current v0.60.0 link returned to the current title. [These recorded browser observations](../native/observations.md) establish only the listed scope. They do not establish physical-device, full-phase or human-playtest acceptance.

## Immediate next work

1. **P05 Team correction.** Team already shares display, menu and picture adapters; it does not need those systems rebuilt. The successor corrects the clipped focused Large-text selector and preserves space for Pause and both players' touch controls. The latest pinned browser retests cover desktop, short landscape and portrait successfully, including the broader live-shell fix. Final composition, exact-source qualification and its own public release remain; physical touch/controller and zoom acceptance are separate.
2. **P05 Controller Practice and Playground.** Integrate the independently prepared shared-display work and readable map diagnostics. The final `c79fd477` successor for last-Undo focus loss and empty/unready geometry measurements passes both complete Node 20/22 cohorts; the same strengthened fixture distinguishes five behavioral failures on the qualified parent. Complete its nine actual browser correction rows before integration and release. Existing scoped observations preserve an unapplied draft and preview while settings change and recover from real application-module failure; they do not close all navigation or device checks.
3. **Finish concrete P03 gaps alongside those presentation corrections.** Prioritize remaining owned decision/cancel paths, real pagination and Team terminal results before wider lifecycle/offline/device qualification. Do not repeat already accepted practice-exit or already recorded ordinary navigation journeys as new coverage.

Further P05 supporting-route candidates cover Production/Viewport, Motion Lab and Recovery. Production/Viewport already have scoped browser observations; additional responsive and lifecycle cases remain. Motion/Recovery and the smaller disabled Replay-transport styling proposal remain outside v0.60. Studio's cold Back filter/selection behavior and focus after successful mutations belong to the remaining P04 workflow work.

## Prioritized phase register

“Partial foundations; queued” means useful features exist, but the phase's acceptance is still outstanding. A candidate or a passing local test is not a completed phase.

| Order | Phase | Current status and completion still required |
| --- | --- | --- |
| Accepted | **P00 integration; P01 loading; P02-A sound authority** | Complete within their separately retained accepted scopes. P02-B music/content and physical audio checks remain separate. |
| 1 | **P03 native navigation** | **In progress.** v0.59.1 practice-exit correction accepted. Finish the finite decisions, pagination, terminal, lifecycle, recovery and actual-input matrix below. |
| 2 | **P05 shared readable presentation** | **In progress / partial.** v0.60 Studio/Replay scoped delivery accepted with the public evidence above. Finish Team correction and supporting screens, then actual EN/UA glyphs, contrast, palettes, Large/Plain text, zoom, focus and reduced effects across affected routes. |
| 3 | **P08-A artwork and actor parity** | **In progress / partial.** Complete exact artwork identity across Solo/Versus/Team, recognizable roles, heading, displayed scale and both detail treatments while preserving the complete arena and collision rules. |
| 4 | **P08-B action feedback** | **Partial foundations; queued.** Finish trail danger, capture, loss/recovery, bonuses, Support/rescue and catalog-based rewards, including motion readability and reduced effects. |
| 5 | **P09 challenge and intelligence** | **Partial foundations; queued.** Tune fair pressure and routing; introduce readable patrol/carrier/shooter encounters with compatible rules, replay and checkpoint versions. Prove warning/counter clarity and reward-once behavior before bulk campaigns. |
| 6 | **P07 rewards and continuation** | **Partial foundations; queued.** Direct Retry/Next, understandable objectives/mastery, full-picture rewards and optional stories. Failed transitions retain results; replay cannot duplicate scores. |
| 7 | **P02-B music experience** | **Partial foundations; queued.** Finish custom MP3/mixed playlists in every advertised mode, actual-byte transfer and offline playback, failure recovery and an auditioned synth/chiptune/rock/metal collection. |
| 8 | **P04 creation framework** | **Partial foundations; queued.** Complete registries, Studio editing/history, previews, prompts and bundles. Demonstrate original-byte upload → edit → export → import → play and safe invalid/stale/capacity failures. |
| 9 | **P06 discovery and installation** | **Partial foundations; queued.** Unified compatible catalog, explicit downloads, atomic replacement/removal and recovery within storage limits. Interrupted work must preserve the working game and saved run. |
| 10 | **P10 Team encounters** | **Queued.** First Connection/Relay Yard encounter variants, Support/rescue, shared objectives and the separate Team acceptance matrix. |
| 11 | **P11-A–D FPV campaigns** | **Queued.** First Contact, Crossing Lines, Signal Pressure and Last Relay: four independently released twelve-mission campaigns with complete assets, sound, progression and rewards. |
| 12 | **P12-A–D DroneAid campaigns** | **Queued.** Community Connections, Supply Corridors, Contested Signal and Return Signal: four independently released twelve-mission campaigns with clear Support/Combat framing. |
| 13 | **P13 culture; P14 retro; P15 spend management** | **Queued.** Living Atlas, After School Arcade and Spend in Motion: three distinct twelve-mission campaigns with complete edition-specific art, mechanics, audio and review. |
| 14 | **P16 supporting workflows** | **Partial foundations; queued.** Complete Collection, scores, replay, learning, data recovery and legacy-content navigation/state acceptance. |
| 15 | **P17 reproducible authoring** | **Partial foundations; queued.** Update guides, AI skills, prompts and CLI templates alongside each delivery; independently create, install, play, export and recover a fresh-workspace pack. |
| 16 | **P18 full browser qualification** | **Partial evidence; queued.** Cross-phase regression, measured performance/memory, accessibility, media/offline recovery, human playtests and real device/controller acceptance. |
| Later | **Native stores; network multiplayer** | **Deferred separate gates.** Browser completion does not certify native lifecycle, signing, packaging, stores or online session/reconnect behavior. |

The campaign programme is **132 new Solo missions still to produce**, not delivered content. Bulk production follows the existing three-level benchmark's gameplay and presentation gate. This Studio/Replay release does not change the last audited production counts: 15/29 map families and 60/116 pictures delivered; three more families are candidates; 1/12 victory stories delivered; 40 reserve originals accepted as source artwork; complete animated sets and the finished 24-track collection remain unfinished. Source artwork, candidates and installed missions are separate categories.

## P03: remaining finite acceptance

- **G00 — complete:** the scoped practice public correction accepted in v0.59.1.
- **G01/G02:** authored internal capture-stop, exact queued-turn/held-Confirm cases, remaining craft/steering/restart ownership and pending-operation cancellation.
- **G03/G04:** delayed Continue cancellation/retry and save/export/import/cancel/removal navigation. Ordinary earned-picture, challenge and installed-pack Stay/Replace routes already have scoped evidence.
- **G05/G06:** genuine Collection/score pagination, Team terminal results and remaining setup/failed-Next ownership. Versus two-round results and Team rescue/retry/setup already have scoped evidence.
- **G07:** finish the broader responsive/preferences matrix; prior desktop preference-return observations remain valid within their scope. Full P05 typography and physical input are separate.
- **G08–G11:** actual inactive-page story, all-mode foreground lifecycle, disconnected reload/play and saved-run migration. Offline installation and archived-version retention do not substitute for these journeys.
- **H01–H03:** physical controllers, actual touch-only devices and human understanding of navigation.

Human challenge/replay-value assessment, physical controls and touch, browser/OS interruption behavior and full production completion remain open. Each independently completed delivery still requires related-hunk review, a new version, final-source checks, reviewed source/publication PRs, immutable release and actual public verification before its scope is marked Complete.
