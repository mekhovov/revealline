# Preserve precise regional runtime positions

Runtime planning, local/global translation, initial/live adoption poses and terrain/scenery support queries now accept bounded finite millimetre coordinates. Previously these boundaries rejected fractional values even though the production movement/support queries accept them. This prerequisite lets future saved locations retain their actual position instead of silently rounding it.

Authored manifest spawn coordinates and local origins remain bounded integers. Radius, grid, source identities, source hashes, geometry, physics and scoring rules are unchanged. Runtime coordinates still require the exact position shape, finite values, the existing ±100,000,000 mm bound and the declared regional bounds where planning applies. NaN, infinity, extra pose fields and out-of-region positions remain invalid. Query owners still require the necessary verified cells before returning a clear result.

## Verification

The new functional verifier uses the exact Urban mixed-r2 terrain/scenery sources. It checks fractional local/global round trips; unchanged integer authored-spawn/origin rejection; finite/bounds rejection; initial preparation in terrain, scenery and mixed owners; final live-pose adoption; actual fractional support/sweep queries; overlapping-surface and below-ground rejection retaining the previous mixed group; recovery and zero-resource disposal. The preserved pre-change manifest module rejects the same precise runtime position.

All eight existing mixed-owner scenarios and ten continuous-flight scenarios pass, including actual source corruption, cancellation, bounded ownership, crossings, delayed graphics preparation and live-pose adoption. Scoped lint passes. No new module, package count or byte allowance is added.

## Explicit limitation before saved-location admission

This changes coordinate validation only. Existing collision admission checks triangle surfaces and supporting height; it is not a proof that a point is outside every closed solid volume. An observed example is the interior of the original Urban mill slab: body position `{x:41000.25,y:7900.125,z:64000.75}` can place the drone sphere entirely inside the slab shell without intersecting its triangles. A surface-overlapping position at `y:8340.125` is correctly rejected. The limitation predates fractional support and is not repaired by this change.

Stored favourites must be treated as untrusted, even if originally captured during valid flight. Before exposing saved-position restore, add a separate conservative containment/admission check covering thick solid interiors, open or clipped/ambiguous geometry, ordinary clear space, doors, tunnels, elevated pads, missing cells and corrupt values. Ambiguous unsafe poses must keep Arm unavailable and preserve the saved record. Do not silently change production collision or claim this prerequisite admits bookmark restore.
