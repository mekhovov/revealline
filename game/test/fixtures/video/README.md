# Owned diagnostic video

`owned-poster-fixture.mp4` is the exact silent six-second, 640×360 H.264 fixture
created by the project's macOS AVFoundation generator at
`authoring/video-poster/generate-fixture.mjs`. It contains original flat-color
frames and diagnostic frame/time labels, not production art or a finished story.

- Bytes: 75,767
- SHA-256: `5abb074b8a740a3305b1d8c6b84466e46eb51d853e2faacad592182999b2c1ea`
- Original generation: video-poster acquisition worktree,
  `.cache/video-poster/owned-fixture-1/owned-poster-fixture.mp4`.
- The original source browser tested capture at requested 2.0/2.05/6.0 seconds,
  with observed frames 2.0/2.0/5.9; that acquisition does not test this story player.

These bytes are used for real local container/hash checks with explicitly modeled
native video events in Node. Passing tests do not establish a codec, audio,
physical-device, story-browser or offline-storage result. No runtime/build catalog
includes test fixtures. Preserve the original MP4; do not regenerate it in tests.

`owned-avc-aac-fixture.mp4` adds an original mono 48 kHz AAC chirp to those exact
AVC frames. The frequency rises over the six-second timeline, so decoded windows
from different times are distinguishable during physical trim acceptance.

- Bytes: 173,394
- SHA-256: `d592415621ae68175f7b1c182e3024ae09f21e2a4b71fc5e92b08ccaa9c8dcc5`
- Tracks: one 640×360 AVC/H.264 video track and one mono 48 kHz AAC audio track,
  both six seconds.
- Audio expression: `0.18*sin(2*PI*(220+35*t)*t)`, generated locally with
  `aevalsrc`; the silent owned video was stream-copied and the new audio was
  encoded at 128 kbit/s AAC with `+faststart`.

Use this second fixture only for the bounded AVC+AAC browser conversion path.
Passing Node tests authenticates its owned bytes and modeled contracts; a fresh
browser conversion is still required to qualify actual WebCodecs decode/encode,
audible playback, decoded PCM fingerprints and A/V endpoint alignment.
