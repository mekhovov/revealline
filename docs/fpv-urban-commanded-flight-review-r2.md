# Urban mixed-r4: production command qualification

The newer Urban source includes loading courts, hall trusses and connected parking ramps absent from the current `review-r1` Library preview. This checkpoint verifies that exact source through `createRegionalSession`; it does not change the Library row or approve the source as finished artwork.

## Exact identity

- Runtime source: `28527bd6a0699aba0c4892fedfaf2776aefe7639`.
- Terrain manifest: `66ef229f0812c31432bb8b3daac6f16e3dcaea19f44be00395a614bfa587afd7`.
- Scenery manifest: `9ae41033e9a73261eeee3ff2339ceaa0e2f6b47367b212fc1f2de470ca8dacb6`.
- Canonical parking preparation: `5a87ea09102d2939041aa34494a8d56e2ddb5c5b3a236a549e4448cf90bb5c15`.

Both manifests retain the authored `mixed-r4` identity and all pinned assets. Geometry, flight thresholds, collisions and physics were not altered to pass these checks. An early prototype against an older checkout lacked a texture-disposal diagnostic field; the final complete run used the current source above.

## Actual accepted commands

The [verifier](../authoring/fpv-worlds/regions/urban-bando/verify-commanded-flight.mjs) reuses the Railway controller pattern: bounded stick commands, the production radio response curve and the actual shared regional session. It tests self-level and Acro independently.

All two authored starts in both modes prepare paused at their exact coordinates, tick zero and zero contacts; arming before preparation is rejected. Seven routes per mode pass with zero unexpected contacts:

1. Both warehouse loading doors.
2. Loading court approach through the hall.
3. Upper hall lane below the roof trusses.
4. The authored opening in a roof frame.
5. Service road across two cell boundaries.
6. Three parking ramps and two connecting turns in one continuous five-segment flight.
7. The parking structure's open vertical shaft.

There are 14 successful route runs and 32,852 accepted route ticks. Each segment must reach within 0.7 m of its endpoint and settle below 0.8 m/s. The allowed horizontal corridor error remains below 1.75 m and altitude error below 0.75 m; observed maxima were 0.849 m and 0.194 m respectively. The vertical shaft checks horizontal containment and a settled three-dimensional endpoint rather than pretending its deliberate climb is an altitude error.

Controlled starts select a scenario's initial position only. No body state is teleported between ticks or between parking segments. Pausing freezes accepted movement. Every session is disposed, checking an empty scene root and zero owned geometry/texture bytes.

Actual contact scenarios separately prove solidity: in both modes the warehouse side wall stops the drone on its approach side at x=145.278 m, and a zero-throttle roof descent settles on the authored elevated roof at y=12.402 m. Collision counts are not used as route progress.

The [full receipt](../authoring/fpv-worlds/regions/urban-bando/commanded-flight-review-r2.json) includes every segment, actual pose, command-stream digest and the manifest/script pins.

## Reproduction and limits

Run `node authoring/fpv-worlds/regions/urban-bando/verify-commanded-flight.mjs PAIRED_DIRECTORY` against the exact paired source or its byte-identical delivery bundle. The verifier rejects different manifest hashes before preparing flight and reads routes from the pinned canonical preparation record.

This is deterministic command-driven production-session evidence. It is not a recorded lesson, scored course, native rendering review, human controller evaluation, device FPS measurement or default Library admission. Native appearance and the complete new immutable bundle's install/load path remain separate acceptance gates. No user storage or existing installed revision is changed by this verifier.
