# P01 G5 media loading — implementation handoff

Implemented source changes only; no phase acceptance, commit, version allocation, build, deployment, or physical/browser-device claim by this owner.

## Coverage and host hooks

- A35: Story dialog immediately presents read/verification feedback around its existing readMedia/acquire owner. Poster stays visible; Close stays usable; aria-busy is scoped to the staging area instead of suppressing the outer live notice. Native story preparation and delayed Play use the same indicator with existing deadline, epoch, explicit playback, reduced-motion, mute, ducking and poster restoration rules.
- A36: Soundtrack player snapshots add `preparation: { stage, message } | null`. This is an observation of current read/verify/play work; status/playing/desired are unchanged. Generation and individual cached-play observer identity prevent older completion from clearing a newer notice. Root owns app initializeSoundtrack/activateAudio/summary wiring. Published cue cache stays unchanged: the triggering event already gets its procedural fallback; decode is cosmetic background work and must never replay a late cue or block navigation.
- A37: Music Studio uses the shared presenter inside its existing busy/abort/commit owner. Read, verification, atomic save, export and measured MP3 batch progress have immediate labels. A sticky top bar keeps status and Cancel visible. The ordinary elapsed-time summary remains aria-live=off; a separate transport loading notice announces preparation. Audition start/resume has its own status and existing token; stale close/reopen completion cannot change newer UI. v0.56 first-open focus intent and durable commit result semantics remain intact.
- A38: Still-media classic page includes pre-module text/signal and disabled Open. Host opening immediately describes catalogue and original verification, before any readBase await. Audio export reports read and pack phases; Close invalidates old observation. Loading itself opens no media storage.
- A39: Picture editor uses its existing work serial/signal and explicit Cancel/Close, now in a sticky top status bar. Context/original reads, decoded previews, save, original bundle export/review/restore retain current-owner, draft and original-byte boundaries.
- A40: Story editing nests its presenter under the existing parent task and selection fence; decoding, captured poster, binding review/save and story bundles retain their cancellation/commit contracts.
- A41: Video-poster classic page has pre-module feedback; attached workshop retains the presenter instead of the launch script overwriting it. Inspect/capture statuses finish on success/error/cancel and reject stale completion. Delayed initial module completion preserves deliberate focus. Native download links remain explicit.

Direct routes link game/ui/operation-status.css. Root already owns global boot/style registration. No remaining app hook beyond the A36 functions above; app imports are static (an earlier message mentioning ensureMedia was corrected).

## Owned files

Runtime: game/ui/story-dialog.mjs, victory-story.mjs, soundtrack-panel.mjs/.css, soundtrack-player.mjs, still-media-host.mjs, still-media-panel.mjs/.css, still-story-panel.mjs, video-poster-workshop.mjs.
Routes: authoring/still-media/index.html + launch.js; authoring/video-poster/index.html + launch.js.
Tests: game/test/story-dialog.test.mjs, victory-story-ui.test.mjs, soundtrack-panel.test.mjs, soundtrack-player.test.mjs, still-media-host.test.mjs, video-poster-workshop.test.mjs.

## Verification

Final run: `g5-qualified-tests.log`: 172 tests, 172 pass, zero failure/cancel/skip/TODO across 12 focused existing files, approximately 9 seconds. Command covers story-dialog, victory-story-ui, still-media-panel, still-story-panel, still-media-host, video-poster-workshop, soundtrack-player, soundtrack-panel, still-media-bundle-ui, still-story-lifecycle, soundtrack-gain-leases, published-audio. Scoped ESLint passes with zero warnings; owned files formatted; git diff --check passes.

New/extended assertions prove immediate held-read notice and Cancel, error/ready/cancelled terminal state, cached first-open without a second read, cancelled late codec acquisition, newer-source status preservation, current playback gesture ordering, stale preparation after Pause, overlapping cached Play observer ownership, silent read preparation, timer live-announcement isolation, and delayed audition Close/reopen. Existing real byte/MP3/bundle/atomic storage tests and modeled video/controller lifecycle fixtures remain active. The isolated Music Studio DOM test adapter now supports ownerDocument, dataset/classList, and aggregate/clearing textContent required by actual DOM presenter semantics; shared fixtures were not changed.

Retained correction evidence: first run had one obsolete direct-P live-region test (presenter intentionally places the status role on its label); updated the assertion to actual label role. A later layout intermediate exposed a getElementById call before attachment; changed production construction to retain the actual node reference and reran successfully. Final self-review separated live operation labels from the music timer and preserved launch-owned focus without overwriting the presenter. Prior logs remain separate.

Root's subsequent 390×844 held-module browser review found the Still Workshop notice below the viewport. Both direct media routes now place their notice immediately after h1; Still Workshop places its 44-pixel-minimum Back action immediately after the notice, preserving the explanatory consent copy before Open. Two new source-order assertions and the existing route fixtures pass: `g5-route-visibility-tests.log`, 26/26, 444.335375 ms. The initial failing screenshot remains `browser/still-media-held-module.png`; root owns actual corrected viewport revalidation.

## Browser follow-up for root

Observe Music Studio first open and delayed MP3/audition work; verify sticky notice/Cancel stays usable in 1280x800, 390x844, 844x390, Large/Plain/reduced motion and relevant zoom. Open both media source routes; hold/reject a file/codec operation; verify cancellation/late completion and native file download controls. This source slice does not establish P03 navigation, P02 master mute, P08-A artwork, or public P01 acceptance.
