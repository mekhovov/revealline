# Bounded Urban streaming qualification

The authored Urban review-r2 region now fits Advanced's collider admission limit.
The per-frame limit changes from **64 to 128 colliders**. Because the total
recorded-collider definition ceiling is derived from the 512-frame limit times
the per-frame collider limit, it also rises from **32,768 to 65,536**. Geometry,
snapshot, recording, recovery and history byte limits, frame counts and event
counts remain unchanged. No geometry is dropped or merged. Backend identities,
fixed 250 Hz physics, collider order/properties and
existing recording interpretation remain unchanged.

The initial mixed window has 79 colliders and previously failed before flight.
The [preserved 64-collider evidence](fpv-regional-urban-64-admission-evidence.json)
records the explicit rejection and an unchanged unstarted flight. A survey of all
nine window origins in the digest-admitted, unchanged region found 27–124
colliders. The largest window contains 33,419 vertices and 26,882 triangles;
its source frame occupies 1,549,467 JSON bytes, below the existing 65,536-vertex,
131,072-triangle and 2 MiB frame limits.

## What was checked

The new probe follows the existing authored road/court route with a clearly
labeled automated acro test pilot. It uses the real production Regional adapter,
verified terrain/scenery preparation, automatic streaming, transaction admission,
and a dedicated worker running the production message protocol. It loads the
unchanged locally available delivery through its normal digest verifier. The
verified source cache replaces network transport; no scene assets are altered.

The [correctness run](fpv-regional-urban-streaming-correctness.json) flies for 120
simulated seconds and reaches five authored waypoints. An injected coverage
rejection preserves the complete worker snapshot, including body/controller,
motors, battery, input queue and recording. A held active frame-adoption boundary
also preserves the complete snapshot while another mission is requested. Full
recording replay and recovery verification pass. Recovery preserves consumed
history and dynamics, while allowing its documented current-pose terrain
re-admission at the same mission boundary.

The [capacity run](fpv-regional-urban-streaming-capacity.json) repeats the same
120-second workload three times. Each run actually reaches the 124-collider /
26,882-triangle window, publishes seven terrain events across six unique frames,
and finishes without a terrain-wait pause.

| Repetition | Complete host/worker loop | Real-time capacity |
| --- | --- | --- |
| 1 | 7,950.853 ms | 15.093× |
| 2 | 7,733.203 ms | 15.518× |
| 3 | 7,623.989 ms | 15.740× |

All three pass the unchanged **2×** gate. These timings include the test pilot,
main-thread admission, worker messaging, mission snapshots/recording, streamed
frame preparation/adoption and an event-loop yield between mission calls.
Initialization, initial source verification, exports, replay and recovery
verification are outside that timed interval. CPU-counter observations bracket
each interval; mean whole-host occupancy was 34.55%, 19.64% and 23.06% respectively.

Each exported recording is 1,656,255 bytes, recovery is 3,574,865 bytes and the
final Rapier snapshot is 1,434,038 bytes, under the unchanged 8 MiB recording,
24 MiB + 64 KiB recovery and 8 MiB physics-snapshot limits. Each recording replays
exactly. Streaming publication happens asynchronously, so frame-admission ticks
and resulting integrity hashes differ across separately recorded runs; each
recording freezes and verifies its own actual terrain history.

The candidate was measured in an isolated source copy. Its only production
runtime change was the collider count. All **92** source hashes in both final
reports match the delivered checkout byte-for-byte after adopting that same
change; the [receipt](fpv-regional-urban-streaming-verification.json) records this
binding. Twenty-eight candidate regressions pass, including published arena and
Regional golden traces, complete rollback/replay and the existing twelve-minute
43,200-input storage fixture. The new 128-collider boundary regression rejects
collider 129 atomically and verifies frame/mission rollback, export/replay and
restore. After integration, all ten tests in the terrain test module pass.

## Retained failed attempts

The first [timed candidate attempt](fpv-regional-urban-candidate128-initial-failure.json)
failed without a capacity result. The subsequent
[diagnostic attempt](fpv-regional-urban-candidate128-unpaced-failure.json) identified
final-frame rejection: immediately issuing another mission continuously left a
background publication waiting until its prepared target no longer covered the
current body pose. The production guard rejected that stale publication with
`Mixed geometry cannot support required body pose`.

The probe now yields the event loop after every mission, exposing the same
between-mission opportunity provided by scheduled browser mission calls. That
yield is included in the measured cost. The same route then publishes frames
throughout flight. No route, production timing, geometry, physics or admission
rule was changed to obtain a pass. The earlier
[70-second candidate check](fpv-regional-urban-candidate128-correctness.json)
remains historical evidence for its original runner; it is not relabeled as the
final 120-second run.

## Limits and reproduction

This closes the bounded authored Urban **single-host** streaming/admission gap.
It does not qualify arbitrary regions, maximum-duration dense-scene throughput,
GPU rendering, network download, physical USB input, mobile/Intel/iOS devices or
real-aircraft fidelity. The twelve-minute storage regression is a separate
synthetic changing-input/history fixture, not a twelve-minute Urban performance
measurement. Advanced remains optional, unscored and ineligible as the default.

Use the repository's Node 22.22.2 runtime. Run measured checks alone, after other
browser/native qualification processes have finished:

```sh
node scripts/fpv-regional-streaming-capacity.mjs --correctness /private/tmp/urban-correctness.json --mixed
node scripts/fpv-regional-streaming-capacity.mjs --measure /private/tmp/urban-capacity.json --mixed
node --test game/test/fpv-advanced-terrain.test.mjs game/test/fpv-advanced-terrain-storage.test.mjs game/test/fpv-advanced-qualification.test.mjs game/test/fpv-advanced.test.mjs
```

The source/scene hashes are checked again after each probe. Failures during
flight preparation, stepping, streaming or final verification write a failure
report and exit unsuccessfully. Retained prior failures are not replaced by
later runs.
