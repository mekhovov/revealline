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

## Current-main integration · 26 October 2026

The delivery measurements and worktree/CI statements above describe the dated
15 October work. Current integration retains the newer immutable media inspection,
32 MiB byte cache, preparation scheduler, timeout, resource accounting and cleanup.
The separate configurable decoded-sample cap does not raise that byte ceiling.
Private scheduler phases follow accepted model state; supplied schedulers retain
their own lifecycle. Generic silence cannot open a preparation window during flight.

The current compiled field-kit revision is 105. All thirteen admitted original
recordings remain byte-identical (232,892 encoded bytes); only the bank release
revision changes. Both generated projections are rebuilt from the current canonical
closures. The historical module sizes above are not current measurements. The
standalone assisted-flight archive excludes its unused canonical world-audio module,
while the main build still includes that canonical raw URL and the new cue module.
The finite 100-file/8 MiB flight envelope and all other package budgets remain.

Checks and broad runtime/device/admission qualification may be bypassed under the
user's accelerated merge instruction. Source preservation and tiny fixture checks
do not establish whole-test, browser, native, offline or listening qualification.

## Production package correction (2026-10-27)

The first integrated source exceeded the unchanged Worlds bundled-output limit by 51,060 bytes (21,022,580 / 20,971,520); deployment did not run. Both existing generated modules contained the same portable destruction bank.

The Academy projection now exposes its existing, deeply frozen portable bank as immutable data. The Worlds projection imports that exact data through the already admitted `sim-presentation.mjs` slot. Audio factories, decoded buffers, preparation state and playback lifecycles remain private. Every canonical recording, original provenance record and raw source URL is retained. Static checks compare the entire embedded bank and freeze operations with the canonical source; they never execute application modules.

Refresh in this order: `node scripts/refresh-portable-destruction-audio.mjs`, `node scripts/refresh-fpv-academy-audio.mjs`, then `node scripts/refresh-fpv-reaction-runtime.mjs`. The registered validation command checks that same order and runs `node --test scripts/test-fpv-audio-shared-data.mjs`.

This correction changes no file or byte allowance, package ownership policy, simulation timing or admission setting. Source checks and generated byte savings do not establish a successful deployed build or playable/device qualification.
