# Woodland canopy batching — D1 foundation

This increment makes room for richer Woodland scenery without changing the
current flight environment. It is a rendering optimization, not the finished art pass.

The 66 original crowns now share one unit geometry in 24 material/sector batches.
Eight spatial sectors retain useful frustum culling. Seeded placement, crown size,
colors, trunks, shadows, course definitions, collision, objectives and replay
identities remain unchanged. Meadow's separate grove arrangement is untouched.
Instance resources use the existing renderer registration and disposal path.

## Functional evidence

Run `node scripts/prepare-fpv-woodland-canopy-verification.mjs`, serve this checkout,
and open `docs/evidence/fpv-woodland-canopy-harness.html`. The preparation command
reads baseline `1aef4d70fa37c8911dbb47b4b128c253178c8b60` and writes only one small
ignored module. Unchanged imports come from the current checkout; this is a
focused rendering comparison, not an independently frozen whole-build comparison.

Browser evidence: `docs/evidence/fpv-woodland-canopy-browser.json`.

- 12 cases: both Woodland bounds, a Pixel override and Meadow regression, each
  at Performance/Balanced/Quality; 60 rendered comparisons including shadows.
- Maximum transformed-vertex difference: 0.000003905 metres, from float32 instance
  transforms. Maximum changed-channel ratio above two byte levels: 0.000002171.
- Woodland registered geometry objects: 144 → 79 (65 fewer).
- Overview draw calls: Performance 144 → 102; Balanced with shadows 276 → 192.
  All sampled Woodland views reduced calls by 10–84. Overview triangle count is
  unchanged; some flight views submit additional off-screen crowns within a sector.
- Twelve build/render/dispose cycles return to zero GPU geometry and a stable
  one-texture residual. This demonstrates no growth in this harness, not zero
  residual texture allocation. Per-view renderer geometry counts are cumulative
  across the before/after pair, not isolated per-scene measurements.
- World Studio preparation under existing guards: 94 files, 14,400,550 bytes.
  No new runtime module, decoder, asset download or budget change.
- Changed JavaScript passes ESLint; formatting and whitespace checks pass.

Browser reports Chrome 154 / macOS and WebKit WebGL. These are draw-call/resource
measurements, not physical-device FPS, sustained mobile performance or novice
acceptance. Additional unit coverage remains deferred. Full release qualification
and public deployment verification remain outstanding.

## Next increment

Add original natural asset detail and stronger woodland composition using this
baseline. Preserve playable clearance and shared theme ownership. Container/quad
art remains in independent PR #987; capacity remains in PR #989. Do not mix either
branch's unmerged work into this ready increment.
