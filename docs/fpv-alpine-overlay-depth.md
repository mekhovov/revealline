# Alpine overlay depth correction

Native review of frozen source `99988bef02c5e3bac0143f935ce6419cbdcefdd6` found triangular flicker where the original river, road and snow sheets meet terrain. All 125,278 selected triangles use the exact canonical terrain diagonal and vertex heights, at the original +3 mm. That separation is too small for reliable depth-buffer ordering in the observed distant views. The original negative review and every generated asset remain unchanged.

An explicit optional `alpine-overlays` scenery presentation profile applies polygon depth bias only to the four original opaque visual-only snow, scree, road and meltwater groups with the expected 1 × 1 white texture. The bias is fixed at factor −1 and units −1. It changes fragment depth treatment, never mesh positions, collision, support or flight policy. Depth testing and writing remain enabled; there is no render-order override. The separate reservoir plane, solid structures, vertex-tinted/masked/nonmatching textures, plain default profile and Coastal water implementation remain untouched.

This uses Three.js [Material polygon offset](https://threejs.org/docs/#api/en/materials/Material.polygonOffset), which exists for surface decals and related coplanar rendering. No new schema, module, package count or memory allowance is introduced. The profile is opt-in and no Library entry is added.

## Verification

Run `node authoring/fpv-worlds/regions/alpine-highlands/verify-overlay-presentation.mjs /absolute/alpine-source`.

The exact original manifest hashes are required. Every selected overlay vertex and triangle diagonal is checked against the terrain lattice; all 125,278 remain at +3 mm. Six kinds of negative material binding produced 774 rejection checks, including solids, masks, altered textures and the reservoir colour. Thirty non-overlay surfaces stay plain.

Twenty-four actual production mixed windows cover six authored starts with plain baseline and the three opt-in presentation tiers. Position/normal/UV/index hashes, support and swept queries, owned geometry/texture bytes and total resource counts match the baseline. Active overlay materials have the bounded bias and ordinary depth test/write; every mesh retains normal render order. All owners dispose to zero source, geometry, texture and reservations. The receipt is `receipts-r1/overlay-presentation.json`.

Native close/distant views and occlusion still require review before visual acceptance. These checks do not establish GPU timing, hardware FPS, final representative Alpine art or player admission. The broader plain green terrain and simple blockout structures remain an early study.

For isolated authoring review append `&surface=alpine-overlays` to the existing six-view Alpine preview URL. The plain URL preserves the negative baseline for comparison.
