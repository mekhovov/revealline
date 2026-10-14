# Shared regional support and ground response

## Scope

The regional authoring flight now shares the production World support conversion and ground response. This follows the shared air and continuous-contact extraction; it does not introduce a second flight model.

`flight-support.mjs` contains the unchanged production slope cutoff, sphere-radius support-height correction, fixed-point normal conversion, surface-relative tilt, initial support tolerance, per-tick grounding tolerance, first-touchdown impact facts and horizontal ground damping. World calls these helpers in the same locations and operation order. Its support query filters, hull damage, landing criteria, mission evaluation, recordings and model identities remain unchanged.

A regional `flightSupport` query uses the same pinned Rapier ray convention and shared support conversion. It checks the complete sphere footprint against verified cells, distinguishes missing geometry from an ordinary no-support result, and exposes nearest-hit distance. Mixed owners select the nearest ray hit before accepting its support result: a steep upper face cannot be ignored in favour of a floor beneath it.

The regional body includes grounded/support and first-touchdown speed/tilt facts. Ground response operates on an uncommitted candidate after continuous contact movement. Unknown support pauses without accepting pose, velocity, contact count or tick. Initial support is evaluated only after verified preparation; loading, retry and mode changes remain disarmed. These facts do not award lessons or scores.

## Evidence

Historical baseline: `84544a1e` before this extraction.

- 297 exact old/current production support queries across floor, elevated roof and slopes, three sphere radii, three search depths and eleven heights.
- Grounding at the six-millimetre boundary, rejection one millimetre outside, takeoff rejection, retained first-impact speed, horizontal damping and inverted surface-relative tilt.
- Actual hash-verified paired terrain/scenery: roof/floor provenance, slope radius correction, steep upper-face rejection, missing-cell and cancelled-query handling.
- Two commanded paired flights: roof touchdown at 8,002 mm with first impact 8,226 mm/s, and ground touchdown at 2 mm with first impact 9,144 mm/s. Each retained its original impact through 80 settling ticks, took off again, and paused without further motion. Mesh-ray rounding remains within one millimetre of the authored floor under the existing production ceiling rule.
- All 154 World demonstrations / 312,948 ticks: complete returned replay states and sampled paths match historical model and collision source. Proof identity SHA-256 remains `f31ab85d6090af4d9380f734bc535f67e2ce1a61ffd47e2521bffeb97f40f787`.
- Existing World runtime/model suites: 22 tests passed.
- Existing regional flight, mixed owner, frame transaction, shared input and verified terrain/scenery checks: 57 passed.
- Five actual authored Urban commanded routes passed, including doorway, wall, elevated roof, parking shaft and two origin crossings.
- Scoped correctness lint: 13 modules passed.

Manual checks, from the repository root with historical Git commits available:

```sh
node authoring/fpv-worlds/regions/verify-shared-support.mjs
node authoring/fpv-worlds/regions/verify-support-replay.mjs
```

Node 20.19.5. No golden expectations were rewritten. No device FPS, new hardware-controller or package qualification claim.

## Remaining

The preview remains unscored and `playerReady:false`. Actual production regional host admission, package/lifecycle ownership and qualification remain outstanding. World retains its damage and mission policies; regional actors, weapons and scoring are not introduced. This increment changes no scenery, public catalogue defaults or existing World proofs.
