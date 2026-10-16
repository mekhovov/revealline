# Railway production-session flight verification

The exact structural Railway pair now passes commanded flight through `createRegionalSession`, the same regional session used by the normal SIM host. This closes the gap between geometric sweep checks and actual shared flight movement for the representative corridors. It does not establish final art quality, native device performance or default Library admission.

The verifier uses the normal quantized control-input path, shared flight/collision/support model, paired verified sources and continuous region preparation. A deterministic feedback controller supplies roll, pitch and throttle commands; it does not set body position, velocity or attitude during flight. Each scenario selects a controlled starting position in both manifests, leaving all geometry and asset hashes unchanged. This is controlled route evidence, not a recorded demonstration or an assertion that a beginner can reproduce the controller.

## Results

- Seven routes in each of Self-level and Acro: under the trestle, above its deck, between freight tracks, under the station canopy, through the maintenance hall, along the cutting and through the recovery field.
- 14 completed routes and 25,614 accepted fixed-step ticks, with zero contacts. The controller reaches and settles within 0.7 m of each endpoint; its maximum observed height error is 0.125 m and maximum cross-track error is zero for these straight, axis-aligned scenarios.
- Six actual origin changes beyond initial preparation across the route set, without another arm action. Each accepted tick remains active while source preparation runs between ticks.
- All four authored starts in both modes prepare paused at their exact position, at zero ticks and zero contacts.
- Two deliberate flights into the maintenance wall each register a contact after 129 ticks and stop at x = 279,478 mm, on the approach side of the visible wall. They do not pass through the wall.
- Pause holds the complete session snapshot despite nonzero commands; disposing every route releases the root and geometry/palette accounting.

The exact results are in [the machine-readable receipt](fpv-railway-commanded-flight.json). The source pins are those of [the structural study](fpv-railway-structural-study.md). The test refuses another manifest pair.

```sh
node authoring/fpv-worlds/regions/railway-valley/verify-commanded-flight.mjs /external/railway-structure-r4
```

Remaining: native normal-host appearance and launch review, immutable distribution/installed recovery, sustained real-time player and physical-device measurements, curved/combined-axis freestyle routes and final representative-art acceptance. Ground surfacing in the authoring preview is not automatically present in the normal Library host; its trusted appearance bridge is a separate delivery increment.
