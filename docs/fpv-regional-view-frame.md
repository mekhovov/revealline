# Regional preview: shared flight camera and aircraft

This increment replaces the authoring preview's separate camera equations and crossed-bar aircraft with the existing SIM presentation. It does not admit regions into the shipped player or change flight physics, source admission, collision, recordings or scoring.

## Shared presentation

`createFlightViewFrame` lives in the existing civilian FPV renderer module. Both the production renderer and regional preview call it for FPV, chase, overview and editor framing, aircraft pose and propeller phase. The preview uses the same `buildDroneVisual` racer model and resource disposal as the existing SIM. The production camera equations, operation order, projection and tick-based propeller animation are preserved.

The retained frame object caches its vectors and quaternions. Hosts provide mutable configuration without allocating per-frame options or copied poses. Regional origins are subtracted only for presentation; the canonical integer body stays untouched. The preview's **Loaded area** view frames the current verified cells rather than implying that the entire region is loaded. FPV and chase continue following the body through origin changes.

The authoring page remains explicitly unscored and not player-ready. It does not duplicate production physics or add a second control scheme. Shared pause, arm, reset, touch and controller ownership remain in the input session delivered separately.

## Verification

Run `node authoring/fpv-worlds/regions/verify-view-frame.mjs` from this checkout. The comparison extracts the actual former camera block from immutable main commit `07cf04c4052b1118b644f63809ef6840acb45e08`; it does not change baseline expectations to match the new helper.

- **2,240 exact historical frame comparisons:** FPV, chase, overview and editor; four viewport aspects; two drone sizes; five orientations including inverted; reduced motion; repeated ticks, rewinds and reset. Camera position, orientation, projection, world matrix, aircraft pose/scale/visibility and all rotor angles match exactly.
- **Four origin-shift view checks:** translated camera and aircraft positions agree within `1e-10` metres; camera orientation within `1e-12` to allow floating-point subtraction in `lookAt`. Other orientation, projection, scale, visibility and rotor data remain exact. These tolerances apply only to translated-coordinate comparisons, not the historical production comparison.
- **45 owned aircraft geometry/material resources** are disposed and the model group empties. The shared model exposes four rotors.
- Existing `fpv-workshop-visuals` shared flight/hangar model and calibration disposal contracts pass (2 selected tests; 15 unrelated tests filtered).
- Changed modules pass scoped undefined/unreachable lint, JavaScript syntax and whitespace checks.

These are CPU presentation and ownership checks on Node 20.19.5, not GPU performance or physical-controller qualification. Browser review on the local 9013 authoring page confirmed the actual racer in Chase, hidden aircraft in FPV, explicit Arm followed by W for 800 ms producing 40 ticks, Space pausing, Reset returning to zero ticks/disarmed, and selection of Loaded area. No control lifecycle regression was observed. Terrain appearance remains the separate plain material; this is not an art-quality or FPS acceptance. Terrain/scenery integration, mixed-window ownership, production host admission, long-flight performance and device qualification remain later work.
