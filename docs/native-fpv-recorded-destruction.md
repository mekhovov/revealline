# Native FPV recorded destruction

## Delivery scope · 15 October 2026

World, Academy and the retained assisted-flight host use the same published cue
player as Capture and Snake. Five material impacts and eight human reactions
are packaged offline. Native flight retains its existing mixer, master mute,
Effects level, warning priority and one AudioContext. No gameplay rules, actor
positions, simulation RNG or recording interpretation change.

The compiled Sound Studio release owns replacement recordings. Unsaved Studio
drafts do not change a running attempt. The producer validates the compiled
release, exact content hashes and byte lengths, then embeds the selected bytes.
Slots absent from older releases use registered core recordings (the existing
compact encoding for human reactions). The current field-kit revision 104 has
no destruction replacement slots; its generated bank therefore uses core sounds.

After adopting a new compiled release, refresh in order:

```
node scripts/refresh-portable-destruction-audio.mjs
node scripts/refresh-fpv-reaction-runtime.mjs
node scripts/refresh-fpv-academy-audio.mjs
```

Validation rejects stale projections. The immutable optional package pins these
recordings for offline use. Installing a new package is required to adopt changed
published sounds; neither local drafts nor unrelated installed content override
its bank. The legacy assisted-flight host reuses the already packaged Academy
projection instead of adding another dependency closure.

## Lifecycle and limits

- Decode on activation; never delay a catch while waiting for audio. Missing or
  rejected recordings retain immediate procedural feedback.
- A late decode never replays an earlier impact. Pause, replacement and disposal
  cancel pending ownership; pause/mute retire active effects. Restored initial
  events and repeated updates stay silent.
- Native flight admits at most 12 one-shots and 10 recorded feedback voices,
  leaving capacity for warnings. Budget rejection never produces a second
  synthesized catch. Existing repeated-cue filtering remains active.
- The encoded bank is limited to 1 MiB total. Native retained decoded samples are
  limited to 2,097,152 samples (8 MiB of Float32 data). The shared cue service has
  a 16,777,216-sample ceiling (64 MiB). These count retained buffers, not peak
  decoder/browser memory. Oversized decodes are rejected after decoding.
- No existing optional package file/byte allowance or visual effect cap increases.

The baseline bank contains 13 recordings / 232,892 encoded bytes. World and
Academy projections are 1,233,901 and 395,157 bytes respectively. These are
serialized module sizes, not browser-memory or performance measurements.

## Verification boundary

Automated cases cover canonical and both generated players; all five materials;
replacement bytes; offline hash integrity; decode cancellation; mute, pause,
Retry and silent restore; no duplicate procedural catch; decoded-buffer bounds;
and the native warning reserve. Optional-package admission and reproducible
package tests cover closure/manifest integrity. CI includes the new cases in the
industrial presentation phase.

Physical device audition, speaker/headphone balance, peak decoder memory and
worst-case multi-board listening remain unqualified. Full raw source identity
also requires a checkout containing the regional authoring sources excluded by
this worktree's disk-recovery sparse configuration. Full-checkout CI is the
remaining authority for that check. The separate mission-library launch/image
CI failures are not repaired by this audio implementation.
