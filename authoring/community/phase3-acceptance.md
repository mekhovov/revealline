# Phase 3 acceptance — candidate, not released

Status: the mixed-media creator, portable video dependencies and installed runtime are implemented on `codex/creator-phase3-integration`. A release version has not been allocated. Phase 3 remains dependent on the separate Phase 1 and Phase 2 releases.

## Completed evidence

- Standalone images, matched image/video pairs and video-only items pass through the same `creator-layouts.v3` mission assembler. Mixed-input tests create the exact expected mission count, bind stories by video SHA-256, retain poster hashes and prove that media names, poster choices and playback ranges do not select another gameplay algorithm.
- The stacked batch/media/bundle/template/runtime suite passes 68/68 tests. It includes 1/12/50-image package closure, all twelve enemy-and-obstacle variants, paired and video-only packages, corrupt/missing dependency refusal, immutable installed story editions, legal-completion authentication and legacy image-only manifest compatibility.
- The installed-player story, host, UI and bundle suite passes 59/59 tests. It authenticates the exact completion receipt and poster, keeps continuation independent from story preparation/playback, cancels stale work on Retry or Next and preserves image-only campaigns.
- Native poster acquisition passes 38/38 focused tests. A bounded fallback now captures the decoded seeked frame when a browser advertises `requestVideoFrameCallback` but does not deliver it for a paused detached video. Presented-frame timestamps remain preferred; the fallback records `observedMediaTime: null` and `playhead-estimate` rather than inventing frame timing. Acquisition never calls `play()`.
- Built-in-browser paired-media review used `dawn-signal.png` plus the exact 640 × 360, eight-second `dawn-signal.mp4`. The normalized stem suggested the pair, while the UI displayed its byte-backed hash. Generation produced an Ember garden mission with one moving enemy, two walls and two terrain zones. Review reported a 1.24 MiB package containing one PNG derivative and the complete original video.
- Fresh-origin video-only review decoded that MP4 and captured visible poster candidates at requested 0.80, 4.00 and 7.20 seconds. The midpoint was selected. Generation produced a Twin corridors mission with one moving enemy and two walls; review reported a 1.22 MiB portable package with one PNG derivative and one complete victory video.
- The exact video-only review installed as edition `3d7080219aabbc2a32f86b5df428163196829bdcc1fddeb8512cf232d624acf9`. Ordinary Custom play visibly showed the moving enemy and both corridor walls. One legal Down route completed at 80%, three lives and 17,280 points and awarded the captured midpoint poster.
- After player integration, a fresh-origin video-only review installed as edition `628b3b3a2870af81ae457cef5b8fe1c10dbe9c29b70898f84aab73e9ae114895`. It generated a First crossing mission with one moving enemy and two walls. The legal Down route completed at 75%, three lives and 17,640 points. The earned midpoint poster stayed visible, **Play** entered native story playback, **Skip** restored the same poster, **Replay** restarted playback and **Back to my creations** remained visible and enabled throughout.
- Scoped ESLint, Prettier and diff checks pass for the integrated Phase 3 files, including both browser-discovered fixes.

## Corrections made during browser acceptance

- The first video-only trial timed out while capturing a poster even though paired playback inspection of the same MP4 succeeded. The in-app browser exposed frame-callback methods but did not invoke the callback for the paused detached decoder. A bounded 250 ms seeked-frame fallback now retries until decoded data is ready or the existing operation timeout cancels it. A fresh origin was required to avoid the previously cached module; the corrected three-frame capture then passed.
- The first installed-player story trial completed and saved progress but failed before mounting story controls because initial story reset removed the canonical `#earned-picture` element. The host now keeps that poster connected while disposing only transient story presentation. A regression exercises the real player HTML nesting contract, and the fresh-origin browser flow then passed Play, Skip and Replay.
- Filename stems remain review suggestions only. The paired case used the selected image hash, while the video-only case retained the captured poster hash and the complete video hash.

## Remaining acceptance gates

- Verify audible output on physical target browsers, reload during/after story playback, exact package download/import on a fresh origin, full-video byte/hash retention, nondefault playback-range behavior, missing-original recovery and an explicitly unsupported codec.
- Run hosted full-checkout preflight/build/release-ready checks on the final stacked branch, then rebase and release only after the dependent phases publish.
- Firefox, Safari, a genuinely clean browser profile and physical mobile remain untested. The user directed use of the built-in browser when Safari computer control was unavailable.

Physical trimming and conversion are not claimed by this phase. Playback range retains the complete original video.
