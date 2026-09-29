# Analog atmosphere, demo audio and background playback

Verified 2026-09-29 against the local working checkout. This record covers the atmosphere/audio/background extension; it does not supersede the earlier demo content qualification gates.

## Implemented behavior

- All Solo, Versus and Team landing scene profiles receive the locally generated four-frame receiver-noise atlas. Ordinary profiles use 3% opacity, peaking at 6%; technical profiles use 5%, peaking at 12%. Each disturbance occupies the last 600 ms of a 12-second cycle. The existing artwork, atmosphere and text shading remain intact. Hidden/inactive menus stop animating; menu animation off and reduced effects remove decorative interference.
- A prepared demo scene settles over 300 ms. The renderer processes the protected picture before covered cells, terrain, trails and actors. Reduced effects suppresses settling; galleries and ordinary victory rendering are unchanged.
- Pause/Resume demo, Next level and Want to play remain together. The audio card shows title, artist and a verified artist/source link, followed by mute, independent music playback and Next song. Volume, shared style selection and separately remembered Music only / Music + game sounds are expandable. Play style explicitly saves and starts that choice; merely entering a demo preserves mute and playback intent.
- One spectator clock uses visible animation frames or a hidden-page 50 ms timer. It pumps audio even while the demo is explicitly paused. Simulation recovery is bounded to two seconds in at most 250 ms slices, yielding between slices and respecting the live bot's remaining validated maneuver budget. Hidden playback does not paint or accumulate visual effects; delayed recovery produces no sound bursts.
- Spectator blur/hidden/native inactivity clears controls without pausing watching or cancelling its next source. Practice and pending takeover retain focus-loss safeguards. Audio/player UI owns keyboard, controller and touch input. Crossing that UI boundary clears held practice actions, including touch Boost and queued abilities.
- The standalone edition and public offline closures now retain the bot Worker, catalogue and all twelve frozen replay variants, in addition to the new clock, audio module and atlas. Native staging tests check the exact bytes.

## Automated verification

All commands below passed. Some cohorts overlap; their counts must not be added as unique test totals.

| Cohort                                                                                                                            | Result  | Local log                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------- |
| Clock, real hidden host, audio view/host, soundtrack player, preferences, input, protected transitions, jammer and landing scenes | 179/179 | `.cache/demo-feature-final.tap`           |
| Ordinary/demo isolation, handoff and fullscreen                                                                                   | 28/28   | `.cache/demo-host-final.tap`              |
| Final audio view and input, after the UI focus fix                                                                                | 64/64   | `.cache/demo-input-audio-final.tap`       |
| Input, controller router and touch steering, including held-touch/held-pad focus regressions                                      | 100/100 | `.cache/demo-input-focus-review.tap`      |
| Actual app audio, after the UI focus fix                                                                                          | 2/2     | `.cache/demo-audio-host-focus-review.tap` |
| Edition, offline and native inventories                                                                                           | 25/25   | `.cache/ambient-inventory-tests.log`      |

The hidden-host cohort independently verifies a replay's exact 120-tick advancement after one second, no hidden canvas paint, a paused minute, source loading across blur, visible unfocused advancement, and completed-scene rotation without requestAnimationFrame. Clock tests also cover freeze/resume, stale callbacks, one-minute gaps, independent audio scheduling and a synthetic two-hour scheduler loop. Bot budget tests cover pending maneuver boundaries and watchdog/fallback behavior.

The visible stall/rotation regression now waits for the observable 120-tick catch-up before advancing its synchronous fake frame clock. An arbitrary 20 ms delay previously left queued catch-up work unprocessed by that test fixture. Its three subsequent completed scenes are all won and replaced by independent runs; the ordinary checkpoint and storage remain unchanged.

Reproduction commands:

```sh
node --test game/test/demo-clock.test.mjs game/test/demo-background.test.mjs game/test/demo-audio.test.mjs game/test/demo-audio-host.test.mjs game/test/soundtrack-player.test.mjs game/test/demo-experience.test.mjs game/test/demo-input.test.mjs game/test/demo-transition-picture.test.mjs game/test/jammer-picture.test.mjs game/test/menu-scenes.test.mjs
node --test game/test/demo-host.test.mjs game/test/demo-fresh-handoff.test.mjs game/test/demo-fullscreen.test.mjs
node --test game/test/edition-runtime.test.mjs game/test/boot-build.test.mjs game/test/native-menu-inventory.test.mjs scripts/test-offline-core-closure.mjs scripts/test-edition-offline.mjs
node scripts/localization.mjs check
```

Scoped ESLint and Prettier checks passed. `git diff --check` passed. The final localization check covered both languages, 10,954 messages and 8,601 references. The atlas generator reproduced the same 147,343-byte PNG with SHA-256 `c2d184ff126006479ee8f18809e2f5c0c83e1793f61339e257b48505ee02921d`.

## Accelerated soak

The retained [machine-readable report](demo-atmosphere-2026-09-29/accelerated-soak.json) records **7,251.975 simulated seconds in 209.095 elapsed seconds** with real Worker threads: 179 scenes, comprising 92 replay and 87 bot scenes, both turn policies, 179 independently verified recordings and 179 pause checks. The 29 safe bot-to-replay fallbacks were expected. There were no faults or preparation failures. All 179 players and 87 Workers were disposed, with no remaining Worker threads/listeners. Final post-GC heap was 27.220 MiB and the observed maximum was 27.463 MiB.

This exercises real sources, director, simulation and Worker cleanup. It is **not** a two-hour wall-clock browser soak or proof of uninterrupted browser execution. The separate clock and hidden-host tests exercise the new scheduler.

## Browser observations

Used a temporary Codex in-app browser tab at `http://127.0.0.1:8779/game/`. The user's original game tab was not reloaded. Inspected English and Ukrainian labels, recorded scene playback and rotation, explicit pause, expanded audio options, unchanged muted/paused entry, source credit metadata, and Back restoring the previous Settings context. The temporary tab was closed, Ukrainian restored and viewport override reset. No warnings or errors appeared in the review tab's captured console.

- **Desktop 1280 × 800:** full viewport demo, prominent sharp board, audio settings expand in the sidebar. [Screenshot](demo-atmosphere-2026-09-29/desktop-en.png).
- **Portrait 390 × 844:** primary playback actions stay in one row; song title and artist precede audio transport and remain outside the disclosure. No horizontal overflow in the dialog, panel or audio card. [Screenshot](demo-atmosphere-2026-09-29/portrait-en.png).
- **Short landscape 844 × 390:** board and scrolling sidebar remain usable; primary demo controls and track credits remain visible. Lower audio settings are reachable by scrolling. No horizontal overflow. [Screenshot](demo-atmosphere-2026-09-29/landscape-en.png).

These are viewport checks, not physical phone/controller/native-device certification. Shared landing profile tests cover all 18 themes and motion gates; there was no separate manual screenshot review of every theme/mode combination.

## Remaining release verification

The requested two-hour wall-clock loop with repeated real foreground/background transitions, enabled audio, physical input devices and actual browser/OS freezes remains a release gate. So do physical-device/large-text viewing review and the earlier unfamiliar-viewer comprehension gate. A full distributable build was not produced during this change; fixture-based offline and native staging checks passed.

Browsers can throttle hidden timers and the OS can freeze a page entirely. The implementation preserves spectator and music intent and continues when execution resumes; it cannot run while the environment prevents JavaScript execution. Navigation/page disposal ends the session. No native background service was added.
