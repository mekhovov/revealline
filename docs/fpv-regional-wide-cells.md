# Bounded 256 m regional cells

15 October 2026. This is a runtime capability, not a new shipped large world.

## Why

The original regional format fixes cells at 128 m. An 8.192 km square needs
4,096 cells, exceeding the existing per-layer asset count once every cell has a
canonical scene and collision source. This increment additionally accepts 256 m
cells. The same area then needs 1,024 cells. Actual authored delivery must still
fit the existing download and residency limits; this does not guarantee any
particular region will fit.

Both sizes keep the same 33 × 33 height samples and triangle count. Terrain
spacing is 4 m at 128 m and 8 m at 256 m. The coarser choice is for broad natural
terrain; detailed structures still use bounded scenery geometry. An author must
choose one size for the entire paired region. Mixed lattice sizes, unsupported
sizes and source/manifest mismatches fail before admission.

## Changes and compatibility

- Terrain compilation, normals, visible meshes and collision use the declared
  cell size. Canonical 128 m output retains its previous bytes.
- Verified terrain/scenery sources bind their size to the manifest. Existing
  companion-grid equality also prevents mixing differently sized layers.
- Coverage queries, origin translations, heading, flight limits, presentation
  bounds and overview camera range use that same size. Existing 128 m framing
  and flight behavior are unchanged.
- No vertex count, local-origin distance, resident-cell, source, texture, geometry,
  download, package or offline budget is increased. Unsupported older clients
  reject a 256 m manifest rather than treating it as a 128 m map.
- No catalogue pin or existing authored region is changed. Existing installed
  revisions, recordings and lesson scoring retain their identities.

## Functional evidence

Node 20.19.5, shipped Three.js/Rapier, real production compiler/source owners,
collision queries and flight stepping:

- `verify-wide-cells.mjs`: old 128 m canonical GLB hash matches main `e712301`;
  256 m extents retain 1,089 vertices/6,144 indices; 8 m slope normals; unsupported
  and mixed-size rejection; declared bounds; six windows at negative coordinates
  around −16 km; actual far-half roof/ground/wall queries and cross-cell sweeps;
  missing-cell rejection, failed-stage retention and disposal. Both flight modes
  prepare disarmed and require explicit arm. Continuous flight traverses two cell
  boundaries over 4,013 ticks with three origin placements and zero contacts,
  without re-arming.
- Existing terrain (11), shared-normal (4), material/collision parity (5),
  verified terrain (12), verified scenery (11), RGBA lifecycle (5), mixed owner
  (8), and continuous-flight (10) scenarios pass.
- Existing planner scenarios pass across 7,200 sampled positions; host-session
  and finite-position scenarios pass. The old planner verification now reflects
  the already-merged finite runtime-position contract; authored positions and
  origins remain integers. Normal fixtures now include their required cell size.

## Native player evidence

The Codex in-app browser, 1280 × 720 viewport, loaded the normal player on a
read-only local host pinned to `55bd243481dd152b28eb0d479742c2928b65786d`.
The optional verifier export supplied its six-cell negative-coordinate fixture;
it is intentionally plain diagnostic geometry, not an authored world.

- First launch was Ready to arm at 10 m with zero input and drift.
- FPV → Chase → Overview → FPV changed view without arming. Overview framed
  the loaded 512 × 256 m window, including the far-half roof/wall fixtures.
- Explicit Arm, held keyboard throttle/pitch, then Pause produced a paused
  snapshot at 1.8 m, +2.7 m/s vertical, 0.6 m/s drift and 63% throttle.
- No browser warning/error messages were captured during this journey.

The optional output argument to `verify-wide-cells.mjs` writes a fresh directory
for repeatable native review and refuses to overwrite an existing candidate.

These checks do not establish device FPS, sustained real-time flight, a
4/8/16 km authored region, final material quality, or qualification of a new
player package. An actual bounded large-region candidate and integrated release
qualification remain. Current 128 m art and Library work can publish independently.
