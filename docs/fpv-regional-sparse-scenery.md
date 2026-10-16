# Explicit empty scenery for large regional terrain

This increment admits terrain-only cells without synthetic meshes. It does not publish a new region, enlarge existing residency budgets, or qualify the 8 km Canyon for the Library. Existing World.v1 courses, scoring and flight equations are unchanged.

## Source and delivery contract

`FPVSceneryManifest.v1` is a distinct opt-in scenery profile. It retains the complete grid, explicit chunk IDs and coordinates, region identity, revision, spawns and existing manifest limits. A known-empty cell has `assets: []`; an entirely empty companion also has an empty top-level asset list. Every grid cell must still be declared exactly once. Unknown cells, omitted cells, duplicated cells and unresolved assets fail validation. A missing scene or collision download never means empty space.

Primary terrain remains `FPVRegionManifest.v1`. The old manifest still requires scene and collision declarations in every cell. Nonempty cells of the new scenery profile use the existing canonical geometry and hash verification pipeline.

`FPVRegionalDelivery.v2` explicitly binds a complete terrain manifest and this sparse companion, including both manifest hashes and every declared dependency. The existing v1 descriptor accepts only the existing complete scenery format; changing an existing descriptor's format cannot silently relax its declared coverage. The authoring builder selects v2 only for the explicit sparse profile. Installed revisions retain their exact descriptor identity and cache-only source adapter.

## Runtime behavior

Empty cells grant coverage only after the verified scenery window admits the hashed manifest. They allocate no source payload, mesh, texture or collider. Their isolated query world remains owned and disposed through the existing lifecycle. Empty prepared coverage returns no scenery support or collision; outside/unprepared cells remain unknown. Restore checks remain conservative outside known coverage.

Mixed terrain/scenery adoption remains atomic. Terrain still supplies the floor. A later populated cell can supply roofs and obstacles. Failed or cancelled preparation preserves the previously committed pair. Zero source/geometry allowances apply only to explicitly empty sparse scenery; combined staging/residency limits are unchanged.

## Verification

- `verify-sparse-scenery.mjs`: seven functional groups pass, covering strict old-format rejection, missing/duplicate/unknown declarations, zero-payload empty ownership, real populated scenery collision/support, corrupt-stage retention, cancellation/retry, and delivery closure validation.
- The same suite runs 2,200 actual shared-flight ticks across four cell crossings with exact conservative-reference state parity and zero scenery requests. A separate 256 m case checks declared cell coverage and fractional saved-position restoration while disarmed.
- Existing continuous-flight scenarios: 10/10 pass, including 40 residency swaps. Existing conservative restore scenarios: 9/9 pass, including visual-only RGBA exclusion.
- The existing Urban v1 delivery regenerates its unchanged 38-file closure and exact 6,615-byte descriptor, SHA-256 `1ba27d2242d61d61c0552564d75baa5f3e313e63a78c2ef434f63cdc7dbab94c`.
- Scoped lint passes. No runtime module or package file-count/byte cap is added.

The 8 km terrain authoring source and its complete sparse delivery must still be independently generated, checked, packaged and reviewed through normal Library installation before any player-availability claim. This receipt does not claim hardware FPS, unlimited worlds, or new public deployment.
