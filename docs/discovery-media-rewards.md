# Audio and video discoveries

Audio and video use the existing typed completion-reward sidecars. They change presentation only: requirements, accepted Journey wins, scoring, replay and reward receipts retain their existing authorities. Both payload types are admitted by the shared player/compiler capability inventory.

Authors add a payload to an existing reward with explicit requirements. Company Studio validates the complete JSON draft before applying it, and the eligible-state preview uses the same `mountRewardMedia` viewer as Collection. Locked previews do not acquire the recording. Level/Campaign Studio preserves media payloads when importing/exporting a reward sidecar and offers local-file playback previews beside its reward bindings; files are matched against the authored SHA-256 pins. Neither preview receives a player progress store.

An audio payload has this shape (replace the example hashes with the original files' SHA-256 values):

```json
{
  "id": "object-story",
  "type": "audio",
  "locales": {
    "en": { "title": "An object's story" },
    "uk": { "title": "Історія предмета" }
  },
  "asset": { "assetId": "object-story-audio", "sha256": "EXACT_SHA256" },
  "transcript": {
    "en": { "assetId": "object-story-en", "sha256": "EXACT_SHA256" },
    "uk": { "assetId": "object-story-uk", "sha256": "EXACT_SHA256" }
  }
}
```

A video changes `type` to `video` and additionally requires `poster` (one exact image reference) and `captions` with `en` and `uk` exact references. Every recording, poster, transcript and caption file must be an approved entry in the selected edition asset ledger and its dependency closure. Record provenance and redistribution rights in the existing asset source workflow. A referenced public URL is not a media source; no iframe, remote stream or autoplay is supported.

The admitted formats and limits are:

| Role       | Format                 | Bound                                                                                  |
| ---------- | ---------------------- | -------------------------------------------------------------------------------------- |
| Audio      | MP3, Ogg, WAV          | 32 MiB per source; native duration at most 120 seconds                                 |
| Video      | MP4, WebM              | 32 MiB per source; native duration at most 120 seconds and picture at most 1920 × 1080 |
| Poster     | Static PNG, JPEG, WebP | Existing 4 MiB raster import and dimension limits                                      |
| Transcript | UTF-8 `.txt`           | 64 KiB per locale; plain text                                                          |
| Captions   | UTF-8 `.vtt`           | 64 KiB per locale; 1–256 plain cues                                                    |

These are admission ceilings, not additional package space. The complete edition remains within its existing 32 MiB asset budget and core offline output remains within 64 MiB/2,000 files. Longer recordings need a separately qualified optional package; this adapter does not admit one automatically.

Captions use the following bounded WebVTT subset:

```text
WEBVTT

00:00.000 --> 00:03.000
A plain-language description of the first image.
```

Cue IDs are optional, timestamps must increase in start order, and ends must remain within 120 seconds and the decoded recording duration. Cue markup, CSS, region declarations and positioning settings are rejected. Both languages must be packaged even when only the selected language is read at runtime. A transcript remains untimed and selectable.

## Playback and recovery

The player loads the exact transcript and local poster when an earned reward is opened. It acquires the recording and captions only after an explicit Play action. A browser that requires another gesture after loading gets a visible Play-again prompt. Opening or changing a reward never starts playback automatically, including when reduced motion is enabled.

Native audio/video elements use `bindAudioMasterMedia`, so game mute and volume remain authoritative. Playing a second reward pauses the first; the foreground player acquires a zero-gain lease from the existing soundtrack mixer and releases it on pause, failure or disposal. Blur, hidden documents and controller disconnection pause playback. Closing, switching and aborted loads remove subscriptions, native sources, tracks, object URLs and gain leases. No preferences or reward receipts are written by the viewer.

Current exact assets are preferred. Earned originals can also be loaded from registered, hash-checked retained presentations within the same permitted edition audience. The viewer never substitutes newer media when an old pin is unavailable. Transcript/poster alternatives stay visible when native decoding fails. The compiler checks current and retained media bytes, MIME/container correspondence, caption structure and complete selected closure; runtime native decoding is still capability-dependent.

## Qualification evidence

`game/test/reward-media.test.mjs` uses an original generated PCM-silence fixture, the existing owned diagnostic video, and explicitly modeled native metadata/play events. It checks selected and retained SHA pins, wrong MIME and malformed text/captions, studio round trips, unreviewed source exclusion, missing media, cancellation, decoded duration/dimension limits, mute/volume, foreground ownership, and 20 repeated paired playback/disposal cycles. `game/test/edition-rewards.test.mjs` verifies the actual earned-view branch: locked payloads are not fetched, explicit playback uses the host sound owner, and closure does not alter progress.

These automated tests do not replace native codec checks, actual device playback, caption readability review, or human comprehension review. Those remain reported separately.

## Public campaign key pictures

A campaign descriptor may declare `heroAssetId`, referencing one PNG, JPEG or WebP asset in that campaign’s own `assetIds`. Company Studio’s campaign picture selector previews that public role and applies it with a new containing-edition revision. Clearing the role omits the field, preserving the legacy descriptor shape.

The expedition overview displays this explicit public picture beside the campaign title and progress. It does not inspect a locked reward’s payload for artwork. Mission buttons, launch guards, requirements and gameplay identities remain unchanged. The compiler checks the key picture’s exact bytes and existing raster limits, and the role assignment participates in the presentation receipt so an old run can restore its exact public composition. Historical presentations without the field preserve their existing hashes.
