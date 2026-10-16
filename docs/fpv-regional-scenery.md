# Verified regional scenery preparation

This increment adds an explicit **colour-only scenery profile** alongside the existing terrain profile. It prepares visible Three.js geometry and Rapier collision from the same canonical per-cell triangles, then commits them together as one detached authoring window. It does not change World.v1, physics, recorded proofs, player packages or default Library admission.

## Source and geometry contract

`FPVRegionScenery.v1` is a separate collision-source contract: an exact chunk identity, a 128 m cell, and bounded surfaces containing integer millimetre positions, triangle indices and opaque RGB colours. X/Z coordinates must stay inside their owning cell. Invalid indices, degenerate triangles, duplicate identities, unexpected fields and non-finite values are rejected. Global Y remains bounded by the region manifest.

The compiler produces a deterministic, self-contained GLB with explicit non-metallic materials and no external textures, scripts, animations or decoder dependencies. The renderer and Rapier use the same compiled positions and indices. Uploaded GLB bytes must match the canonical GLB **exactly**, in addition to their manifest size/hash checks; a separately valid but different visible scene cannot substitute for the collision surface.

The existing `FPVRegionManifest.v1` and verified source window remain unchanged. Each cell in this profile declares exactly one scene and one collision asset. This profile cannot silently accept a terrain cell, arbitrary GLB or texture asset role.

| Allowance                              | Limit                                     |
| -------------------------------------- | ----------------------------------------- |
| Collision JSON per cell                | 1 MiB                                     |
| Canonical scene per cell               | 512 KiB                                   |
| Surfaces / vertices / indices per cell | 128 / 8,192 / 24,576                      |
| Source window                          | 16 MiB default, configurable up to 32 MiB |
| Combined retained + staged geometry    | 8 MiB maximum                             |

Geometry accounting includes position, normal and index arrays. It does **not** claim to measure JS object overhead, temporary compiler buffers, Rapier internals, GPU driver allocation or sustained device memory. Source decoding is separately bounded. Equal colours share material objects within a window; geometries, materials, collider world and scene ownership are released when replaced or disposed.

## Transaction and lifecycle boundary

`createVerifiedSceneryWindow(manifest, options)` exposes `transition(positionMm, supportPose?)`, `group`, `snapshot()`, `support()`, `sweep()`, `cancel()` and `dispose()`. Successful transitions expose only the required nearby cells, provenance and one ready render/collision window. Queries use `scenery-hit`, `scenery-clear`, `unknown-cell` or `not-ready`, as appropriate. A missing section is never interpreted as a clear route.

The source loader verifies declared bytes before decoding. Canonical scene comparison, spatial ownership, geometry budget and optional body-support/overlap checks all precede adoption. A failed or cancelled successor retains the old visible group and provenance, but disables readiness and collision queries. Latest generation wins; stale work is disposed. An optional support pose uses the same bottom-of-body position convention as the regional prototype, with its sphere centre one radius above that position and 1 mm contact tolerance.

**Composition remains open:** terrain and scenery are independent detached windows. Calling their two `transition()` methods sequentially would not make a combined player frame atomic. Production integration must use staged/detached results and synchronously adopt terrain, scenery, physics, origin, camera and all other world owners only after every component validates. This PR deliberately does not attach this scenery window to the current terrain-only flight prototype.

## Urban Bando regional derivative

The original 384 × 384 m study from #1222 is preserved. The new exporter pins its exact scene hash and validates all original collision vertices against the serialized GLB before producing a derivative. It clips triangles at 128 m cell boundaries, quantizes positions to 1 mm, discards collapsed fragments, and emits nine independently owned scene/collision pairs. It does not replace whole buildings with solid bounding boxes.

The derivative contains **4,421 triangles** and **561,044 source bytes** across eighteen assets. `provenance.json` records the original scene hash and the exact existing Kenney CC0 receipt hash. Original textured props remain preserved in the source study; this first regional profile carries their geometry and base material colours, not their texture maps. Finished materials and texture admission remain subsequent work.

```sh
node authoring/fpv-worlds/regions/urban-bando/prepare-regional.mjs /path/to/verified-urban-study /path/to/new-regional-output
node authoring/fpv-worlds/regions/urban-bando/verify-regional.mjs /path/to/new-regional-output
node authoring/fpv-worlds/regions/verify-verified-scenery.mjs
```

Serve the repository and expose the external output through an intentional local server path. Open `authoring/fpv-worlds/regions/scenery-preview.html?manifest=/your-output/region.json`. The authoring preview offers six viewpoints, uses the verified pipeline rather than directly loading the original scene, and includes an explicit resource-release action. It is not a flight screen.

## Functional evidence

- Eleven local HTTP / shipped Three.js / shipped Rapier scenarios cover exact sources, semantic rejection, hash corruption, retained failure, latest-wins cancellation, cached cancellation, combined allocation limits, unsupported roles, disposal, twenty repeated transitions and support-pose admission.
- All nine Urban canonical GLBs pass the glTF validator without errors or warnings.
- All fourteen original Urban opening/solid sphere sweeps still pass after clipping and quantization.
- Six explicit cell/origin transitions retain at most 371,364 geometry bytes and 104 meshes in this representative fixture. Replacement emits disposal for 374 geometries and 33 shared materials during the counted transitions.
- Skylight support reaches the ground; roof support remains at 12.4 m. A body intersecting the warehouse wall is rejected without replacing the prior frame, and a body on the roof is accepted.
- Existing twelve verified-terrain scenarios and twelve source-window scenarios remain passing.
- Two independent Urban regional generations produce twenty byte-identical output files.
- Desktop in-app browser review on 14 October 2026 confirmed overview (9 cells / 104 meshes), aligned loading doors (6 / 71), and parking openings (4 / 46). Release clears the view; reload restores the overview and district view. No console errors were observed during that geometry/lifecycle review. Shared-theme verification is separate from this receipt.

These observations qualify the bounded preparation pipeline, not two-hour flight, device FPS, full production memory, offline install/update, runtime scene composition or catalogue admission. The 4.096 km Urban target and final art quality remain unfinished.
