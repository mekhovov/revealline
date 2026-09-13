# Owned video → inspected poster acquisition

This isolated source addition starts from `e29f2ac9207b047c07e6b72f94fa24cea9b00e1c`. It implements only a local video inspection/seek/capture capability in [video-poster.mjs](../game/video-poster.mjs). No game, workshop, Collection or store imports it. Existing still presentations remain strict `revealline-media-presentation.v1` records with `story: null`; no host, saved run, award, playback or backup format changes here. A future build of this branch would include the new module through the ordinary `game` include; the already frozen edition is unchanged.

## Acquisition contract

```js
const source = await openVideoPosterSource(file, { signal });
// source.original: owned original Blob, exact bytes, screened video MIME
// source.info: immutable { sha256, bytes, mime, width, height, durationSeconds }
const selected = await source.capture(
  12.5,
  {
    id: 'station-poster',
    provenance: { kind: 'original', credit: 'Author', source: 'Owned station test clip.' },
  },
  { signal: captureSignal },
);
// selected.blob: actual PNG from the selected decoded picture, never regenerated
// selected.asset: existing validated PNG still asset with its own SHA and provenance
// selected.capture: sourceSha256, requestedTime, observedMediaTime, playheadTime,
//                  timingEvidence, decodedFrame, width, height, mime, sha256
source.dispose();
```

The adapter snapshots a native Blob/File without consulting its filename, MIME, overridden byte reader or own getters. It recognizes a bounded MP4 `ftyp` header or WebM EBML `DocType`, then requires actual browser video metadata. This is container screening plus selected-frame decode, not validation of every packet/frame or support for every codec. Unsupported containers/codecs, audio-only files, malformed metadata and missing browser capabilities fail explicitly. No remote source URL is accepted.

Source limits are 64 MiB, 120 seconds and an intrinsic display picture no larger than 1920 × 1080. Longer/larger input fails; the adapter never silently trims or scales it. A future segment-selection/transcoding workflow is separate. These acquisition caps do not reserve or raise the shared manager's 256 MiB total-plus-staging budget, metadata cap or physical-row limits. Original video bytes stay with the caller; opening/capturing never commits them. PNG preparation retains the existing 4 MiB cap and full browser still decode.

Each capture owns a fresh paused, muted, zero-volume inline video element and an object URL. It never calls `play()`, including during fallback capture. It waits for available seek ranges, rejects invalid/out-of-range times and gaps, assigns the requested time without clamping, and waits for seek completion where a seek was needed. It can capture the initial time-zero picture without waiting for a nonexistent seek event. A browser that cannot deliver a requested paused frame times out explicitly; there is no hidden playback workaround.

`requestVideoFrameCallback` records the browser's `mediaTime`, then draws the video synchronously inside that callback before asynchronous PNG encoding. Requested time and approximate playhead remain separate fields. Callback decoded width/height are recorded separately from intrinsic display dimensions; the complete display picture determines the canvas aspect and PNG dimensions. MDN describes `mediaTime` as the presented frame's media timestamp, notes possible callback scheduling delay and distinguishes media-pixel dimensions from `videoWidth`/`videoHeight`. This supports observed frame evidence, not arbitrary frame-number accuracy or a strict compositor-synchronization promise. [MDN frame callbacks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).

When frame callbacks are unavailable, the adapter captures a ready paused picture after loading/seeking, sets `observedMediaTime: null`, `decodedFrame: null` and `timingEvidence: 'playhead-estimate'`, and records the current playhead separately. Its PNG is still the actual encoded output. A future UI must visibly say “Frame timestamp unavailable; approximate playhead …” rather than displaying the requested decimal as an observed timestamp. Setting `currentTime` requests a seek; the playhead alone is not decoded-frame evidence. [MDN currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime).

A valid newer capture cancels the earlier operation. Within one capture, a nonzero seek also invalidates the initial frame-callback registration with a new epoch; a queued initial-frame callback cannot publish after the seek. Dimensions and duration must still match the inspected source immediately before drawing. External cancellation, disposal, decode/export failure and the whole-operation timeout reject rather than publish late output. Owned listeners, frame callbacks, canvases and URLs are released; late native callbacks are ignored. `dispose()` is idempotent and prevents future capture. The caller may retain returned original/PNG Blobs deliberately; disposal cannot erase bytes already held by that caller. An inspection signal owns inspection only; each later capture uses its own signal. Invalid new arguments fail before allocating a decoder and leave an existing valid request alone.

Trusted host/test capabilities may inject `createVideo`, `createCanvas`, `URLImpl`, `decodeImage`, timers and a bounded timeout. They are executable capabilities, never uploaded JSON. The returned capture record is owned evidence for this acquisition call; copying it into arbitrary JSON does not mint a verified media asset or a valid story record. Any future serialization/import requires its own bounded schema and validation against original/PNG hashes.

## Smallest next integration, before story expansion

1. Add an explicit local video file choice and inspection state to the still workshop, with keyboard/controller/touch controls for a numeric seek and a native range control. Keep the prior saved assignment and preview visible until a complete candidate is accepted. Changing source/context or closing cancels pending inspection/capture; reopening does not revive stale operations. Do not silently replace a saved flight's picture or first-earned receipt.
2. Show source bytes, dimensions and duration, then let the author select a time deliberately. Present requested seek and observed frame time separately; show the fallback label when needed. Preview the exact captured PNG at full/partial reveal before a separate **Use this poster** action. Persist the actual accepted PNG through the existing prepared-still/assignment pipeline. Preserve existing originals on a failed/cancelled operation.
3. If only that still is saved, retain `story: null`; the game consumes the exact PNG as ordinary managed still media. The capture provenance should identify the original source hash and separate time evidence in a future validated acquisition record. Do not add unknown fields to the current strict still/presentation schemas or pretend `.rlmedia` currently stores video.
4. Original-video retention needs a versioned media asset/record and shared-manager reservation/accounting design first. Reserve actual new video plus PNG and staging bytes atomically against audio and other media; use immutable source bytes and commit only validated candidates. Define both versioned binary export/import inventory and compatibility with old readers before exposing **Save original video**. Preserve exact selected PNG independently when an optional video is removed.
5. Story segments need separate start/end choices, MIME/codec/runtime derivative limits, and optional replayable/skippable playback from the beginning to the selected ending image. A win must record its achievement once before presentation. Replay/Skip cannot create another award; missing video cannot replace the retained earned PNG or block progress. Keep music/effects/cinematic volume and interruption recovery separate. This adapter neither probes segment continuity nor implements these journeys.

The next UI should let players control narrative pace, replay important information, use consistent inputs and access a static alternative to moving presentation. Those are accessibility recommendations; our proposed explicit Capture/Use/Skip/Replay controls are implementation choices. Test focus, readable text and practical targets without shrinking the game or hiding critical controls. [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/).

## Qualification and honest limits

The focused [tests](../game/test/video-poster.test.mjs) exercise owned-byte/container guards, native metadata and seek boundaries, observed-vs-requested time, initial-zero and fallback capture, anamorphic sample/display distinction, exact generated PNG bytes, cancellation/stale callbacks, timeout and error cleanup. HTML video, Canvas and still decode are explicitly modeled capabilities; the PNG fixtures are real encoded files with CRCs. These tests do not demonstrate a real MP4/WebM codec, browser frame delivery, video audio behavior, picture quality, hardware performance or complete container validation.

Retained checks in `.cache/video-poster/check-2/checks.json`: **60/60 affected tests passed on Node 22.22.2**, including 37 new acquisition cases and 23 unchanged still/schema cases; **37/37 acquisition cases passed on Node 20.19.5**. A cache-only negative control disabling the new seek-epoch invalidation fails its stale-frame regression as expected; this is not a historical Git-source run. The earlier 58/35 pass remains preserved. Scoped lint, formatting and diff checks passed. Independent module/test review closed after the seek-epoch correction; final evidence pins remain separately recorded. No full source gates, browser run, commit, freeze, tag or release is performed for this isolated addition.

The next actual-browser exercise should use a locally owned short clip with visually distinct time-coded frames and an audible test tone, recording its exact bytes/SHA, dimensions, duration and encoding command. Upload through the real file chooser; inspect, seek at zero/middle/end and repeat a seek; capture and download the exact PNG. Record requested time, observed callback time (or explicit fallback), actual PNG SHA/dimensions and a screenshot of the frame. Confirm that capture never starts audible playback. Cancel a pending seek, change source/context and close/reopen; ensure no late candidate appears. Include unsupported/corrupt media, empty/gapped seek range where available, oversized input and deliberate source-duration refusal. Browser-specific missing paused-frame callbacks remain a documented timeout until inspected. Save/assignment, fresh-profile binary restore, collection/story playback and offline journeys require later integrated tests; none is implied by this primitive.
