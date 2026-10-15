# Team and Duel extended desktop observation — 15 October 2026

The development-only [Journey observer](verification/journey-performance.html) supports explicit 30-, 120- and 300-second frame samples. Thirty seconds remains the default. This change adds observation capability and tests. A completed native two-minute Team observation is recorded below; it is not a matched-baseline result or a memory-leak diagnosis.

## Use and interpretation

Load the observer from the local review server, select the mode and mission preset, then load the review game. Confirm the actual requested mission in the game's normal chooser. Set **Frame sample → Next foreground play** and **Duration → 120 seconds** (or 30/300), then select **Observe 120 seconds**. Start or resume using ordinary game controls and keep playing in the game. The duration is captured when armed; subsequent changes to the selector cannot shorten a running observation. The existing 60-second arm timeout is independent of the requested observation duration.

The observer continues to require the exact selected mission and actual foreground play. Pause, results, focus loss, mission change, hidden document and navigation discard active samples. Page departure now immediately retires the pending frame sample, including when animation frames stop. Interrupted samples record requested and observed duration without exposing their partial frame/heap data as a completed measurement. No game state or input is generated, and the observer remains outside the release include list.

Heap readings use only the browser's available `performance.memory` values. The timeline records a reading at the start, approximately every five seconds, and at completion, with a hard bound of 62 readings and a separately named `peakObservedUsedBytes`. Missing, invalid or inaccessible counters produce `supported: false`, not zero use. An observed peak can miss short allocations, and these nonstandard counters may include shared heaps. The observer does not force garbage collection, identify retained objects, measure complete decoded image/audio/GPU allocations, or infer a leak from an endpoint or the timeline.

The old 10,000-frame cap could silently omit later frames from long observations. The extended observer retains up to 120,000 intervals and discards the sample if that limit is exceeded. It spreads the existing maximum 120 HUD snapshots across the requested window, preserving late activity rather than recording only its opening minute. Browser long-task records remain capped at 2,000; the report now exposes `omittedCount` if that cap is reached. All recording and presentation overhead remains part of the observation.

## Verification

`node --test scripts/test-journey-performance-observer.mjs` passes **33 tests**, with zero failures, cancellations or skips. The local log is `.cache/multiplayer-desktop/observer-extended-tests.log`. Formatting, lint and whitespace checks pass for the changed observer and test files.

New regressions exercise all three requested durations, the default and invalid-value fallback, duration capture at arm, and waiting for real foreground play before the observation clock begins. They interrupt a 120-second sample after 70 seconds for pause, focus, mission, visibility, page departure and navigation; none becomes a completed measurement. A five-minute synthetic-clock case observes more than 10,000 frame intervals, retains late slow frames and HUD changes, and distinguishes an intermediate heap peak from a lower final value while preserving bounded sampling. Missing, invalid and throwing heap counters remain unsupported.

These tests execute the observer against finite DOM/browser-clock fixtures. They verify observer logic, not desktop performance, physical input latency, browser-specific heap accuracy or sustained human play. Earlier native samples remain bound to the observer version and source recorded in the [desktop qualification report](team-duel-desktop-qualification-2026-10-15.md); they must not be relabelled as 120- or 300-second samples.

The observer implementation changes only `docs/verification/journey-performance.html`, `docs/verification/journey-performance.mjs` and `scripts/test-journey-performance-observer.mjs`. Native receipts are separate from those source changes.

## Native Mac continuation

The [raw observer log](verification/team-duel-public/team-aurora-120s-observer.json) retains the failed first arm (no embedded game focus within 60 seconds) and the subsequent completed **120,003.9 ms** foreground sample of **Expedition Homecoming**, using local source base `859d5cfc927daff2a350318b2325486a58959648` plus this continuation. The native keyboard focused Resume before the successful sample. The local game used a 1280 × 561 CSS-pixel viewport, DPR 2, with sound off. Source pins for the observer actually measured:

- `docs/verification/journey-performance.html`: `2140fec8d538bc1c3d07e78b384d36792afcbaf4d1040124fe4a57e731f775de`
- `docs/verification/journey-performance.mjs`: `d34cc64aa680e5bef9057bb34651802a7f49cd54fcb44b1ed9d5ff3b04e082e0`

The completed window contains 14,393 frame intervals: median **8.3 ms**, p95 **10.2 ms**, p99 **13.2 ms**, maximum **33.3 ms**. The available page-wide long-task observer reported zero entries. Twenty-five JavaScript heap readings ranged through a highest observed value of **63,423,494 bytes**; the first/last values were 52,765,358/57,964,162 bytes. This does not establish a leak or a complete memory budget. Decoded-media/GPU memory remains unavailable.

Both seats received eight trusted gameplay keydowns, with no injected game state. Territory rose from 0.0% to 2.3%; one reserve was consumed during a real exposed-line failure. Subsequent movement stayed on reclaimed ground for most of the window, with idle gaps between observations. This qualifies the longer observer and a bounded running scene, **not sustained high-pressure combat, a finale clear, or representative worst-case load**. A browser-control call timed out late in the sample; the game stayed foreground and the observer completed normally, as its focus/activity record shows. The game was paused only after the completed log was saved. No matched baseline is inferred.

## Native Duel Sentinel continuation

The separate [raw Duel log](verification/team-duel-public/duel-sentinel-native-120s.json) retains the unsuccessful initial mission-selection timing observations and the later completed **120,012.5 ms** foreground sample. The accepted mission is **Crown Photo Finish**, exact key `candidate/versus-expedition-sentinel-pack/versus-expedition-sentinel/versus-crown-photo-finish/standard`. Normal library selection and the explicit **Replace & play** action adopted the mission; the preset URL alone had retained Harbor Gambit. A mission-choice timing observation timed out and is not a passing load-time measurement. The frame sample was armed separately after adoption, then started by explicit Resume.

This run used source `23f1b7a64a8f9897c88b7295095033ff1ef561ab`, with only unrelated release-reader and development-probe edits in progress. The two observer hashes above still match. The actual Duel host hash was `468d4c3e224de29440cfcfec167dd0067530dc44b25f306d4181229130845eb8`; published-audio and feedback-director hashes were `420bca6644f845d63b51200a3b407028eff53578670c57ba082cb9d0da60e61f` and `8381a6708e42fb650d954708942dc05a302e781dbeaf556a7fec538e392e202d`. These are scoped file pins, not an immutable edition receipt.

At 1280 × 561 CSS pixels, DPR 2, sound off, the observer retained **10,732** intervals: median **9.7 ms**, p95 **21.2 ms**, p99 **25.2 ms**, maximum **202.9 ms**; 28 exceeded 33 ms and five exceeded 50 ms. The available page-wide long-task observer returned zero entries. Twenty-five browser heap readings peaked at **133,408,282 bytes**; first/last readings were 92,554,939/112,236,033 bytes. Complete decoded-media/GPU memory remains unavailable. Other development/test processes were running on this Mac; this was not an isolated benchmark.

Each board received six trusted gameplay keydowns and banked **0.7% / 150 points**, with one lost life and recovery each (three lives to two). Shield-relay and lane warnings remained active; the attempt stayed on stage 1 of 2 with no captured relays or mission clear. Browser control sent native keyboard holds, producing actual cuts and recovery, followed by movement on safe ground and idle gaps. The observer never drove inputs or changed state or clocks. The [paused endpoint](verification/team-duel-public/duel-sentinel-native-120s.png) was captured only after the completed raw log was saved.

This closes the missing two-minute Duel observation within that limited activity scope. **Sustained pressured play in both modes, a matched baseline, complete memory ownership and genuine storage-pressure recovery remain open.** The Team and Duel samples use different mechanics, activity and machine load; their frame percentiles do not establish a regression or improvement.
