# Continuous gameplay implementation

Working branch: `codex/snake-continuous-play`. Updated 2026-10-05. No public deployment is claimed by this document.

## Shared flow

Start, Continue, Next, Retry, Random, and Skip enter play directly. Optional mission information remains available through Choose mission. The existing compact Menu UX pause structure, settings-return behavior, focus graph, and generated optional-package sources remain the integration contract.

Ordinary Snake loss runs a 650 ms impact effect, eight replay moves from nine compact snapshots at 240 ms/move, and a 400 ms ready cue before retrying. Immediate Retry skips the delay. Victory retains a 5,200 ms celebration and a separate cancellable 5,000 ms auto-next countdown. Next/Retry work throughout; a loss never starts victory confetti. Home, another action, backgrounding, and controller disconnection cancel pending progression. Engines still own simulation and persistence; the host-owned transition controller owns delayed launches.

Snake Results automatically loops its final-eight preview without advancing simulation, saving attempts, awarding progress, or rearming countdowns. Next, Retry/Rematch, Home, and continuation status remain in the action footer; the bounded preview and details scroll. More options holds secondary actions. Other modes place statistics and countdowns inside their actual result cards. Explicit View picture has a reachable continuation dock; accepted new attempts clear reward-only presentation before painting the new run.

## Living Circuit and live interference

Living Circuit is a third board style alongside Theme and Retro. `classic-scenes.mjs` exports:

- `resolveClassicBoardScene({ boardScene, chapterId, levelId })`: explicit `orchard`, `workshop`, or `relay` wins; `auto` resolves by chapter, with a stable identity fallback.
- `classicSceneBackdrop(scene, { document })`: cached procedural PNG data URL for the outer board-card background, or `null` when Canvas is unavailable.

The host passes `boardStyle: 'living-circuit'`, `boardScene`, and `chapterId` to `drawClassicBoard`. Scene choice is cosmetic: it consumes no simulation or hazard RNG and changes neither canvas dimensions nor playable coordinates. The quiet center uses the current `industrial-roster-v3` material generator; ornamental trees, workshops, crates, and native machinery live in the external frame. Only accepted wall cells receive raised wall materials. Shared actor art, accepted facing, footprint, and art-revision behavior remain authoritative.

Jamming processes the **live** board through the shared `applyAnalogSignalNoise` effect. It replaces the earlier opaque blackout. At most 65% of the feed is processed, horizontal tearing is bounded to 0.15 cell, and a two-cell neighborhood around every head plus source cells stays readable, including wrap seams. Reduced effects freezes noise and tearing while still refreshing live positions on simulation ticks. The renderer draws antenna/radius cues; each host-owned board status line carries reception text outside the playfield.

The follow-up tracking treatment separates current terrain from actors and cable before receiver processing. During a burst, distant moving detail survives only in the remaining clean feed; stronger snow alone was compared and rejected because it still retained most target contrast. The nearby two-cell region, source and danger markers remain clear at native resolution. The three-treatment comparison fixture supports manual steering without player saves or awards. See [jamming comparison](verification/living-circuit/jamming-comparison.md) for research, measurements, browser evidence and alternatives.

New recipes opt into local six-cell or full-board broadcast profiles. A dedicated accepted `hazardSeed` varies their schedule independently of target/spawn randomness. New attempts and retries roll that schedule; Continue and recordings preserve it, while matched Versus boards share it. Pulse freezes the schedule and stabilizes reception; catching a source ends its interference. See [field mechanics](classic-snake-field-mechanics.md) for timing, counterplay, and compatibility.

## Progress and compatibility

Enemy totals count accepted live simulation events, including failed attempts and bonus targets, using resumable transactional lineage counters. Replays, previews, and imported history do not create awards. Backup merges use the maximum per lineage. Menu disclosures show run/lifetime totals compactly; the existing Collections page retains portrait cards, filters, and picture ownership. Snake grants no new pictures.

Verified finite Snake clears earn completion stars. There are 219 current calibrated exact setups and 30 retained historical calibrations. Variable-hazard recipes retain completion and personal records without implying equivalent silver/gold thresholds. The v4 catalogue has 24 missions, with Broadcast Check and Quiet Channel before the combined encounters. Relay Airfield then uses broadcast interference. Historical v1–v3 recipes and unprofiled v4 recordings retain their behavior. A bounded archive admits the five exact retired v4 recipes for Continue/import/Retry and preserves their higher grades; community entries cannot inherit archive authority.

## Main integration decision

Integrated `origin/main` at `2d447bc790` into this feature branch. The original Menu UX baseline is preserved at `261db930d`; the completed earlier UX refinement is `d457f69bbe`. Shared-source conflicts retain the host/engine ownership above, main's target-facing observer, accepted `artRevision`, shared machinery/material generators, and optional-package generation. Open PRs #1095 and #1098 were inspected: their separate appearance/continuation ownership was not copied into this integration.

Key source boundaries:

| Concern              | Sources                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Transition ownership | `game/ui/continuous-play.mjs`, `continuous-celebration.mjs`                                              |
| Native hosts         | `game/app.mjs`, `game/couch/`, `game/snake/classic-app.mjs`, optional Academy/Gym/Worlds hosts           |
| Visuals              | `game/snake/classic-view.mjs`, `classic-scenes.mjs`, `classic-signal-view.mjs`, `classic-target-art.mjs` |
| Rules and replay     | `game/snake/classic-core-v4.mjs`, `classic-match.mjs`, `classic-recent-replay.mjs`                       |
| Progress             | `game/enemy-stats.mjs`, `game/ui/enemy-stats.mjs`, `game/backup.mjs`, Snake records/ratings              |

## Verification scope

The final renderer/scene/fixture/scheduler group has **32 passing tests**, covering unchanged geometry/replay identity, quiet materials, chapter selection without RNG, native target heading, live bounded noise, wrapping, readable danger outlines, double broadcast antennas, Pulse/terminal behavior, and reduced-effects/cache refresh. All **144 current recordings** for 24 missions × Solo/Team × three paces pass qualification. Calibration checks verify **249 exact setups**, including 30 historical gold records. These checks establish deterministic completion, not universal human difficulty calibration.

Review found and corrected a mid-burst speedup edge: an accepted catch could change the next interval from 200 to 190 ms and overshoot the burst deadline. Profiled scheduling respects the hard duration bound at a visible simulation boundary, with start/deadline timestamps shifted together during Pulse. The regression exercises an accepted catch; legacy checkpoint compatibility still passes. The host suite passes **49 tests**, including fresh Retry seeds, exact Continue, historical recipe retention, and paused scene changes. Independent review exercised all 360 prepared archive variants and community-alias rejection.

Browser checks cover the three scenes, local/broadcast interference, Solo/Team/Versus fixture playback, reduced effects, English/Ukrainian, 320×640 portrait, and 740×360 landscape. The real 320px results dialog is 592.75px high, with automatic replay and Retry/Home visible and no horizontal overflow. Screenshots and the final verification record are in `verification/living-circuit/`. The manual fixture at `game/test/manual/snake-visual-fixture.html` runs real verified journals without saving or awarding progress.

The tracking-treatment follow-up passes 81 targeted renderer/scene/fixture/host checks and all 12 fixture scenarios replay to their accepted outcomes. Browser comparison covers original noise, stronger snow and selected detail loss, live reduced-effects movement, manual steering, and a 290px-wide Team board at 320px without horizontal overflow. Simulation and proof data are unchanged.

Final repository validation and lint pass. All six canonical shared projections are byte-identical. After disk space became available, a full build of implementation revision `8b34e111fe7cf7e7fcaf538fe7c51cea4a6c1fa1` produced 3,084 distribution files plus the manifest (1,004,022,352 payload bytes). Every expanded-file and ZIP-member checksum was verified against the manifest, including ZIP CRCs. The ZIP SHA-256 is `d2ac50530f266564e50c47f2d4669cec966a68824507563d4680078048d8431d`; the manifest SHA-256 is `51d702f7fc864fbac2eba093042f3447d16760752646809f18425936226e2c52`. The task-created disposable output was removed after verification, retaining the checksum record and approximately 2 GiB free space. Source and Git history were preserved. This verifies the distribution build, not publication admission.

CI follow-up corrected stale mandatory-briefing and picture-gate assertions while preserving input-release, save, replay, focus, and data-isolation checks. It also fixed statistics shutdown callbacks and cancelled-import writer mutation, with an explicit observation → flush → close → reopen regression. Studio previews now use isolated statistics storage and never open the player database. The follow-up passes 131 targeted checks, including 23 statistics lifecycle/persistence tests and four Studio preview isolation tests. The optional fourth-app maintainer fixture now explicitly declares its reviewed core-only settings-tools import; the archive still excludes those core tools.

The main-game picture suite passes five checks covering the full/reduced celebration, immediate Next/Retry, explicit More → View picture, timer cancellation, and held Confirm ownership. The older fullscreen-gate assertions were replaced to reflect the approved accessible-action flow; the runtime required no additional change.

Earlier verification belongs to its corresponding source, not automatically to the current merge:

- Initial implementation `241a388ab`: 127 combined Snake/statistics/transition/audio tests, 109 shared/non-Snake checks, nine optional-package checks, full validation, and a 3,010-file build (`88a7bcd4…`). Its victory timing was 3.8 seconds.
- UX refinement `d457f69bbe`: the retained measurement record reports 106 Snake/shared/core checks, 73 optional-host checks, nine package checks, full validation and a 3,010-file build (`16333648…`). Browser checks covered Snake and core at 320×640 and 740×360, live picture-view Next, automatic Next, and reachable actions without horizontal overflow.

Detailed previous measurements remain in `verification/snake-continuous-play-measurements.json`. Those build hashes do not certify the new Living Circuit/variable-signal source. Physical controller/touch sessions and human difficulty calibration remain separate from deterministic tests.
