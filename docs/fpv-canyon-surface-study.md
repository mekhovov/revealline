# Canyon terrain surface study

14 October 2026. Authoring-only increment; not a finished environment or player admission.

The verified terrain window now accepts an optional Canyon sediment material.
The default remains the existing plain material. Performance, Balanced and Quality
share exact geometry, collision and source provenance. The material adds world-space
sand/rock colour, slope blending and restrained strata; the latter two tiers add
procedural grain. No texture download, runtime decoder, vertex displacement or
extra geometry is introduced. A shared material belongs to each prepared window
and is disposed with it. Global coordinates preserve the colour pattern when the
local origin changes.

`authoring/fpv-worlds/regions/surface-preview.html` prepares the source and shaders
before replacing a view. Gorge, Basin and Spires views, plain comparison and three
tiers are available. Failed preparation retains the last view; Release cancels
preparation and releases resources. The page uses the shared theme entry.

## Verification

- `node authoring/fpv-worlds/regions/verify-terrain-surface.mjs <Canyon-source-dir>`:
  five functional scenarios on nine exact-hash Canyon cells. All profiles retain
  identical positions, normals, indices, support and swept collision, source cells
  and geometry allocation. Repeated disposal releases the shared material once.
- Existing terrain and verified-source scenarios: 11 + 12 passing.
- Shared theme-bootstrap contract: nine passing.
- Codex in-app browser, 1280×720: all three shader tiers prepared; Gorge, Basin and
  Spires rendered. Gorge reports nine cells / 456,408 geometry bytes. These are
  workload observations, not device FPS or total-memory measurements.

## Remaining

Terrain shape and lighting still reveal coarse slopes. This is a material foundation,
not P2 art acceptance: seam/normal refinement, authored rock/vegetation landmarks,
lighting composition and sustained device budgets remain. Production regional flight
integration and catalogue/package admission are separate. No change to existing
course identities, recordings, scoring, physics or package limits.
