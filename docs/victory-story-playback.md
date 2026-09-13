# Optional victory-story foundation

This isolated successor slice adds a strict story sidecar and a native presentation
component. It does not attach stories to flights, victories, Collection, stored
presentations, backups or the offline cache. The published still formats remain
unchanged: `revealline-media-library.v1` presentations require `story: null`, and
saved picture pins and first-earned receipts keep their existing exact shapes.
There is no version bump or database migration in this slice.

The desired later sequence is **record the win once → show its exact poster →
optionally play the pinned story segment → return to that same poster**. Playback
and Replay must never award anything. This component deliberately has no award,
simulation, assignment or storage callback. Until a separately reviewed versioned
receipt can pin a story, callers may use the sidecar only for an explicit preview;
adding a story today cannot silently change an older earned reward.

## Descriptor and preparation

[`game/victory-story.mjs`](../game/victory-story.mjs) exports:

- `validateVictoryStory(value, { library, identityCatalog })`: snapshots and
  validates a descriptor against the existing branded still and owner catalogs.
- `prepareVictoryStory({ descriptor, blob, library, identityCatalog }, options)`:
  validates before awaiting, inspects the original native Blob with the existing
  video acquisition adapter, compares every declared source fact and returns a
  privately branded, frozen `{ descriptor, original }` preparation.
- `requirePreparedVictoryStory(prepared, picturePin)`: accepts only that in-memory
  preparation and its identical managed-still pin. JSON that resembles it is not
  playback authority.

The exact sidecar fields are:

```js
{
  format: 'revealline-victory-story.v1',
  id: 'one-local-story',
  revision: 1,
  picturePin, // Existing exact managed-still snapshot, without added fields.
  source: {
    sha256, bytes, mime, width, height, durationSeconds
  },
  segment: { startSeconds, endSeconds },
  description: 'A concise static equivalent of this optional scene.'
}
```

The descriptor is at most 8 KiB; its nonempty static description is at most 2,048
characters. It references one MP4 or WebM original, at most 64 MiB, 120 seconds and
1920×1080. Times must satisfy `0 <= startSeconds < endSeconds <= durationSeconds`.
Invalid, nonfinite or out-of-range values reject without truncation. Inspection
uses the existing 15-second default deadline and explicit unsupported-container,
codec, cancellation and timeout failures. Decoder factories are trusted test/host
capabilities, not imported document fields.

The picture binding includes its exact authored picture identity
(`baseCampaignKey`, `levelId`, `levelRevision`, `themeId`), presentation ID and
revision, poster asset ID and SHA. It does not itself carry an `executionKey` or
distinguish Standard from Gentle. The later host/receipt integration must validate
execution-to-authored ownership and actual earned-reward authority separately. Validation resolves that exact historical
presentation and asset against branded catalogs; a current assignment B cannot
stand in for pinned A. Foreign owners and a Gentle execution presented as an
invented authored base remain invalid. The caller separately acquires and decodes
the actual poster using the existing verified image path before showing this
component. Matching catalog metadata alone does not prove that image bytes exist.

Original bytes are copied/owned by the existing acquisition path, hashed and
compared to the descriptor. Preparation neither commits a large video nor creates
an asset row. It says the browser could inspect this local original, not that every
browser can play its codec. Matching the poster pin also does not prove the poster
was extracted from this video. Preserve the separate capture record when making
that claim: original SHA, requested time, observed frame/playhead time, evidence
kind and exact PNG SHA. [Video-poster acquisition](video-poster-acquisition.md) defines those
boundaries.

## Presentation API and ownership

[`game/ui/victory-story.mjs`](../game/ui/victory-story.mjs) exports
`createVictoryStoryPresentation(options)` with these options:

```js
const view = createVictoryStoryPresentation({
  container,
  posterElement,
  picturePin,
  prepared,
  volume: 0.7,
  reducedMotion: false,
  musicDucker, // Optional scoped multiplier; see below.
  signal,
  onChange: (state) => renderStatus(state),
});
```

`posterElement` is the caller's already decoded exact poster and must already
belong to `container`. The component borrows that same element, toggles its
visibility and restores its original visibility on disposal. It does not load a
replacement image. It owns one appended section, one native video and one Blob
URL. Video uses `object-fit: contain`, the verified aspect ratio, no loop and no
initial autoplay; native inspection and preparation remain muted.

The return API is `{ element, play, pause, skip, replay, setPreferences, dispose,
snapshot }`. Native buttons expose Play/Resume story, Pause, Skip and Replay; a
labeled range controls cinematic volume. Focus moves to a visible action when the
previously focused button becomes disabled or hidden. The containing native
reader/dialog and controller router must still own their usual focus scope,
Confirm/Back and neutral-input gates. This component does not independently poll a
controller or dispatch flight input. The later host must restore its logical
Collection/celebration focus when removing it.

States are `preparing`, `poster`, `starting`, `playing`, `paused`, `blocked`, `error`
and `disposed`. A snapshot includes requested segment bounds, current playhead,
volume, reduced-motion preference, status reason and a separate `audioWarning` if
the supplied music restoration adapter failed.

`play()` invokes the native `video.play()` synchronously before awaiting its
result. The interface reports playback only after that promise succeeds. Refusal
returns to a static picture and an explicit retry. Loading, seeking and starting
have finite deadlines; cancellation/timeout settles the returned Play promise even
if a native promise stays pending. Late success cannot restore an obsolete play
intent. A stale earlier play result cannot pause a newer intentional replay.

Replay first seeks back to the selected start. Its later playback attempt can be
blocked by browser activation policy; the visible Play retry remains available.
Replay's returned boolean means its seek request was accepted, not that playback
has begun. Do not report successful playback from that boolean. Browsers can deny
script-initiated playback, and the native promise is the relevant start signal.
[MDN: play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play),
[MDN: autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

The start seek must be acknowledged near the requested playhead (one-millisecond
comparison tolerance); that is not frame-accuracy evidence. Playback stops at the
first observed playhead at or beyond the segment end, using frame callbacks plus
current-time observations. Event scheduling can overshoot that endpoint. No exact
frame trimming or sample-accurate audio cut is promised. A premature native end,
changed dimensions/duration, or decode failure is an explicit error returning to
the same poster. Presented-frame timestamps and requested playhead time have
different meanings. [MDN: requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).

Blur or a hidden document pauses playback and releases this view's music lease;
returning to the page never resumes automatically. Skip and end stop media,
timers/frame observers and the lease. One paused video and its single URL remain
owned while the view is open, allowing Replay without a second original. Dispose,
pagehide and external abort remove listeners, clear pending work, mute/unload the
video, revoke the URL and restore the caller's poster. Disposal is idempotent.
Reduced motion keeps the static poster as the default; the user may still choose
Play. Enabling reduced motion during playback returns to the poster.

## Audio boundary

`createStoryMusicDucker(applyGain)` provides temporary multiplicative leases.
`acquire(0.2)` ducks music and returns an idempotent release. Overlapping leases use
the lowest gain; releasing this story's lease preserves another active lease.
`applyGain` must target a **dedicated temporary mixer factor**. It must not call the
existing saved music-volume setter or change song, playlist, position, mute state
or listening intent. If the host has no such mixer, omit this optional adapter.
The soundtrack player now exposes `acquireGain({ factor })`, returning a frozen
`{ release() }` lease. It uses the lowest active factor and multiplies that with
the player’s base volume and current transition fade; MP3 also uses the master
volume. It reuses the existing transient Soundscape gain path, so that low-level
effective music setting can reflect attenuation just as it already reflects
fades. `player.snapshot().volume` and saved preferences stay at the user’s base
value. It never calls Play/Pause, seeks, replaces a track or changes listening
intent. Updating volume while a lease is active changes the base that will be
restored; mute stays mute. Player disposal clears its own leases, and late release
is a no-op. Overlapping stories must release only the lease they acquired.

The host can inject this compatible adapter without the separate ducker factory:

```js
const musicDucker = {
  acquire(factor) {
    const lease = soundtrackPlayer.acquireGain({ factor });
    return () => lease.release();
  },
};
```

Acquisition/refusal is synchronous; the story view already releases a returned
resource if cancellation happens while allocating it. Gain failures are reported
to that view; failed acquisition removes its tentative factor and attempts to
restore the surviving mix. Future transport updates can retry an unavailable
mixer. This API alone does not wire host playback or certify real audio output.
Focused `soundtrack-gain-leases.test.mjs` cases exercise real Soundscape/player
logic over controlled Web Audio and media elements, including mixed tracks,
pending original reads, fades, suspension, independent owners and disposal.

Cinematic volume belongs to this view and never changes the saved soundtrack
preference. A failed gain adapter prevents starting video, or reports restoration
failure without preventing video/URL/listener cleanup. The component cannot claim
that a disconnected external mixer restored successfully. Caption tracks, audio
description, richer audio mixing and preference persistence remain later work.
Keep playback optional, pausable, replayable and skippable, with its static scene
description. These choices follow the accessibility guidance to let players retain
control of presentation and access essential information without mandatory video.
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/).

## Verification and remaining integration

The owned test MP4 is the original silent 75,767-byte, six-second 640×360 H.264
fixture documented in [its provenance](../game/test/fixtures/video/README.md).
Tests inspect its actual container and SHA, then explicitly model native codec
metadata, playback promises, seek/frame events, timeouts, focus and DOM defaults.
They cover historical A/B authority, unchanged strict old formats, mutated caller
input, wrong source/owner/pin, malformed bounds, abort/timeout cleanup, segment
end/truncation, stale play/frame events, hidden-page pause, reduced motion,
independent/nested gain leases and exact poster-node retention. Test receipts keep
prior failed test iterations as diagnostics. No whole-suite/release gate or new
story-browser/hardware result is claimed here.

The earlier source browser acquired this fixture, downloaded the exact PNG at
requested 2.05 seconds with observed frame 2.0 seconds, and manually used that PNG
in the still workshop before a real win. That verifies acquisition and the existing
still handoff; it does not qualify this new story player. Story smoke should use
this owned local fixture, ordinary native actions, blocked playback, Skip/Replay,
background pause, disposal and visible same-poster restoration. No app-state
injection is needed.

Before live adoption, review one complete versioned contract that:

1. Pins the story descriptor identity/revision, original hash and segment together
   with the exact earned poster, without changing old `story: null` records.
2. Resolves original availability before optional playback while allowing the
   already earned poster and one-time win record to remain available on failure.
3. Adds bounded storage/import/export inventory and original ownership separately;
   existing JSON, `.rlmedia` and `.rlsound` formats do not yet carry this sidecar.
4. Mounts the native view after the authoritative award write, and in Collection
   only from that exact new receipt; Play, Skip and Replay make no profile writes.
5. Integrates controller focus, cinematic preferences and a dedicated soundtrack
   gain lease without resuming a user-paused flight or music session.
6. Qualifies real browsers/devices, silent/audible codecs, user activation,
   interrupted playback, cold original recovery and optional offline budgets.

These are integration requirements, not implemented story storage, Collection,
reward, accessibility certification or a finished production-content claim.
