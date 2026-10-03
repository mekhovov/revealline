# FPV Snake pursuit integration — 3 October 2026

This is candidate-source evidence, not public release qualification. Product version remains 0.142.4. The original 48 grid recipes, 24 flight course recipes and historical replay interpretation remain unchanged.

## Implemented scope

- 84 Classic grid layouts, fourteen chapters, four campaigns, all selectable in Solo, Versus and Team.
- 36 new authored levels: patrols, runners, proximity-triggered sprinters, shutters with permanent bypasses, contact supplies and optional couriers.
- Shared preparation exposes Moving-target remix on every catalogue recipe; future catalogue entries use the same validation/derivation path.
- Versioned v2 core and complete match journals; legacy v1 Continue migration. Paired score and survival duels own their deadlines and failed-board state.
- Four Endless presets, fourteen fixed-seed featured sorties, replay-verified records, contribution/supply mastery and fourteen cosmetic chapter accents.
- Shared verified drone/terrain artwork, themes, effects, audio preferences, touch preferences and main-menu Snake navigation.
- Twelve added simulator courses. Flight courses retain separate physics and records; Classic Solo/Versus/Team rules do not imply multiplayer flight.

## Direct production observations

These observations call production preparation/simulation or exercise the browser UI; they are not automated test-suite passes.

- All 7,560 preparations succeeded: 84 layouts × three paces × two target choices × three seat modes × five activity/preset combinations (Campaign; four Endless presets).
- Every new authored Solo mission has a retained verified winning input journal at seed 17. Broken Ring required a second route; its first failed attempt remains disclosed. See [route evidence](README.md).
- Representative Team routes include two clears and a retained partner-body failure. This does not qualify all cooperative maps or all seeds.
- Match journals cover one dead Versus board while the survivor reaches the cap, simultaneous catch deadlines, exact-deadline catches, and fractional legacy-save timing.
- Browser imported the winning Oval Intercept round, displayed 8/8 catches, score 800, 19.4 game seconds and 97 moves. Chapter progress became 1/6 and survived reload.
- First Baffle opened with Moving-target remix and displayed fleeing targets. Retry keeps the accepted recipe and seed; New route changes the seed explicitly.
- Small-screen observations used measured CSS pixels (the browser had an existing zoom setting): 320×569 Versus, 360×640 Ukrainian Team with direction pads, 390×844 Solo, and 640×360 landscape. No horizontal overflow was observed. At 320px Versus, both boards were approximately 212×159px, turn buttons 56px and Pause/Retry approximately 44px. At 360px Team, direction buttons were 52px. Layout changes paused the running round before reflow.
- Simulator hub navigation opened the new Patrol interception playlist with its six correct course names and an exact safe return to the Snake hub.
- Shared asset closure: 823 Company runtime files, 46,064,640 bytes; 728 retained offline files. All twenty inspected Snake/shared dependencies and both immutable sprite hashes were present.

## Verification policy

Automated suites are **WAIVED_SKIPPED_NOT_PASSED**. Relevant core, session, progression, launcher, compatibility and packaging regressions were authored or updated without running them.

Repository lint and validation passed. Validation reported only the existing generated-site navigation warnings. Changed source formatting and whitespace checks passed. The repository-wide formatting check was executed and reported 25 files; every warned file was byte-identical to parent aa7ef6ec2c9791d7367f4e53a0ff80fa1c9c0c06. See [the baseline receipt](format-baseline.json). These unrelated formatting warnings were not silently fixed or presented as a green global check.

The final committed-source default-build inspection is recorded separately beside this file. It inspects the normal build preparation without publishing, writing a ZIP, or claiming merged-main release qualification.

## Remaining release gates

Human play review is still needed for satisfying pursuit, fairness across complete Team campaigns, difficulty across seeds/paces, and whether players understand timing without instruction. Physical multi-touch, gamepad ownership/disconnection, enlarged system text, low-end devices, sustained performance and full accessibility review remain unqualified. The browser viewport observations are not physical-device certification.

A direct records stress observation used 96 rows, including twelve 8,000-step Endless journals (4.47 MB total). Initial verification took 26.19 seconds with a yield between witnesses; repeated read and merged write took 332 ms and 526 ms. Individual long-witness reconstruction can still block for roughly 2 seconds. This is a known large-profile startup responsiveness limit, not a qualified low-end performance result. See [records evidence](../../../evidence/classic-snake-records-cache-observation.json).

No public release, main merge, release tag or version bump is included. The implementation remains a reviewable product candidate. The repository release train and public qualification process still apply.
