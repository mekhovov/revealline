# Amber quarry: authored rock strata

This bounded D2 candidate replaces the generic stone finish on the six existing
Quarry rock masses with broad amber mineral beds, thin bedding lines and sparse
short fractures. The normal and roughness response remains restrained. The
renderer reuses its existing world-aligned six-metre projection so the strata
share height across different rock masses. No position, vertex normal, index, box size,
collision, shadow caster, actor, route or objective changes.

## Exact scope and resource budget

Only authored `quarry` uses the new recipe. The complete six-solid layout must
be present with unique canonical IDs and exact dimensions:

| ID                   | Width × height × depth (m) |
| -------------------- | -------------------------- |
| `rock-west-terrace`  | 22 × 7 × 76                |
| `rock-east-terrace`  | 22 × 9 × 76                |
| `rock-west-rim`      | 8 × 16 × 82                |
| `rock-east-rim`      | 8 × 19 × 82                |
| `rock-central-spire` | 12 × 20 × 12               |
| `rock-landing-ledge` | 8 × 5 × 8                  |

Finite translated bounds are supported; typed and rotated solids are rejected.
Missing, renamed, resized or additional stone solids keep the entire old finish.
This course-wide guard avoids allocating both generic and new three-map sets in
a mixed creator layout. Existing metal conveyor classification stays unchanged.
Pixel and every shared collection bypass the new recipe. The new authored kind
correctly identifies its material role as concrete without changing existing
shared-theme stone metadata or appearance.

The pass replaces the already-owned albedo, normal and packed-property maps.
It adds zero textures, materials, meshes, triangles, instance batches or shadow
passes. Existing quality sizes and sampling limits remain unchanged. Runtime
source growth is 3070 bytes across world-visuals and renderer, below the agreed
4 KiB increment budget. Quarry has no built-in GLB: the actual procedural world
and its authored obstacle meshes are the target, not an imported substitute.

## Functional checkpoint

The [manual CPU receipt](evidence/fpv-quarry-strata-cpu.json) passes 444 checks
across 83 scene cases against main
`0aeb0c2b4342715ba9a19b976114d7d905fed7bd`. It executes source-extracted
`renderObstacle` and the real helpers to inspect actual box UVs, edge meshes and
conveyor panels. Only the approved rock maps, UVs, kind and concrete-role metadata
change. Floor, dressing, all physical geometry and all other environments remain
exact. It covers all five Quarry courses, all three presets, Pixel, all 17 shared
collections, creator fallbacks, deterministic quality cycling and once-only
resource disposal. No new unit coverage is introduced.

In this world-plus-obstacles scope both sides retain 36 geometries, 40 materials,
12 textures and five instance batches. Raw texture storage stays 0.75 / 3 / 12 MiB
for low / balanced / high, excluding mipmaps and other renderer groups. These
are ownership counts, not hardware frame-time measurements.

Frozen candidate module SHA-256 values:

- world-visuals: `9fcc926c537457702ec70f5839ec760904ba1e9bb4f695e4b8daa1a3c01fe742`
- renderer: `28baf7f257c7beb8a8d166aae24d25335e7bf778b53a63d63aace281f50b5b43`

The frozen actual-renderer preview is
`dist/fpv-quarry-strata-verification-source-v3/index.html`: West terrace and
Central spire views with FPV, chase and overview controls. The bounded matrix
covers the authored appearance plus exact Pixel/shared-theme images, a real
imported Courtyard control and a procedural Coast control. Source modules and
harness hashes are pinned. Human visual acceptance, actual-browser results,
fresh retained-proof replay and package admission are pending. No readiness,
finished-world, physical-device or public-deployment claim is made here.

## Published work preserved

Lighthouse #1015 remains ready at
`3de9318f7e4e99c53832e3b480febfb64bee469d`, on its separate branch and recovery
ref, with accepted source/package/player evidence. Quarry is independent and
does not alter that PR or its frozen outputs.

Root separately verified Courtyard #1012 and Warehouse #1014 at public marker
`0aeb0c2b4342715ba9a19b976114d7d905fed7bd`: Courtyard welcome and Loading bay both
rendered, armed through 0.2 seconds and paused, with empty warning/error logs.
The [marker receipt](evidence/fpv-courtyard-warehouse-public-marker.json),
[Courtyard capture](evidence/fpv-courtyard-live-0aeb0c2b4.png) and
[Warehouse capture](evidence/fpv-warehouse-live-0aeb0c2b4.png) preserve those
observations without changing Lighthouse's ready head.
