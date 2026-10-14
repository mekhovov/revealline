# Regional terrain preparation

This authoring-only increment turns bounded height samples into matching visual and
collision surfaces. It prepares a detached Three group and a separate pinned Rapier
query world. It never attaches to either SIM host or changes existing flight physics,
recordings, proofs, package limits, catalogue admission or `World.v1`.

**`flightReady` always remains false.** A successful terrain query is not a safe-spawn
certificate, complete scenery collision, or permission to start a regional flight.

## Contract and compiler

`terrain-cell.mjs` validates `FPVRegionCollision.v1`: exact fields `format`, `chunkId`,
`x`, `z`, `cellSizeMm`, `samples`, `heightsMm`. Each 128 m horizontal cell contains
33×33 integer heights, in row-major Z/X order at 4 m spacing. Heights are global Y
millimetres; values are bounded to ±2,000 m and the manifest's vertical range.
The 16 KiB source ceiling applies before parsing. Unsupported fields, fractions,
missing samples, duplicate cells and wrong cell identities fail validation.

`validateTerrainSeams(cells)` compares every supplied neighbouring boundary sample
with exact integer equality, including corners. It does not infer missing neighbours.
`compileTerrainCell(cell)` returns positions, triangle indices and a deterministic
GLB 2.0 containing the same lattice and triangulation. Geometry is local to the cell's
X/Z corner in metres, with global Y converted to metres. Each tile has 1,089 vertices
and 2,048 upward-facing triangles. No texture, external resource or decoder is needed.
The material is an authoring preview, not production art.

This is a **single-valued height surface**: no caves, vertical walls, bridges,
overhangs, tunnels, buildings or collision volumes. Those need a separate scenery
collision contract. Shared heights prevent geometric cracks, but normal/material/LOD
seams still require the later environment art and rendering pass.

## Isolated preparation API

`prepareTerrainWindow(manifest, cells, options)` validates 1–25 supplied cells,
manifest identities and vertical bounds, seams and an explicit `requiredChunkIds`
list before allocating engine resources. A missing required cell fails closed.
An integer `originMm` within 640 m of each tile is mandatory for distant regions;
this translates newly created resources and **does not relocate a live world**.
The caller's origin is copied so subsequent mutation cannot change query coordinates.

The returned API provides:

- `group`: detached Three terrain meshes for an authoring preview.
- `snapshot()`: cell/geometry counters, disposal state, and `flightReady: false`.
- `support(positionMm, maxDropMm)`: terrain height and normal from a downward ray,
  `no-support`, or `unknown-cell` when data is absent.
- `sweep(fromMm, toMm, radiusMm)`: a spherical shape sweep with hit fraction,
  `terrain-clear`, or `unknown-cell`.
- `dispose()`: removes the group, disposes geometries/materials and frees the query
  world; repeat disposal is harmless and later queries fail.

Sweeps conservatively require the entire horizontal bounding box, including radius,
to be present. This can reject a diagonal route whose broad rectangle crosses an
unloaded cell; it never treats missing terrain as clear. Boundary-straddling shapes
also require the neighbouring tile. Queries do not classify safe landing slope or
check buildings, actors, vehicles, props, targets or obstacles.

The decoded geometry allowance defaults to 2 MiB and counts position, index and normal
arrays before allocation. The limit cannot be raised through this API. At 25 cells,
those arrays total 1,267,800 bytes. This is **not** a GPU or browser-memory measurement:
Rapier internals, object overhead, temporary GLB compilation and GPU copies are separate.

This low-level preparation function accepts authored collision objects and does not
verify source hashes or a separately supplied GLB. For downloaded terrain, use the
[verified terrain coordinator](fpv-regional-verified-terrain.md), which privately loads
exact hashed source bytes, validates collision JSON and requires its paired GLB to equal
the canonical compiler output. Both paths remain detached authoring preparation and
never grant player admission.

## Verification and next work

Run:

```sh
node authoring/fpv-worlds/regions/verify-terrain.mjs
```

The manual scenarios use the shipped Three modules and Rapier 0.21.0. They cover source
rejections, exact seams, GLB/buffer identity, upward triangles, required data/budgets,
negative coordinates, boundary support, high-speed terrain sweeps, unknown tiles,
translated sloped terrain, idempotent disposal and repeated resource lifecycles.
The compiler checks do not substitute for a GLB viewer, production scenery inspection,
actual GPU allocation measurements or player flight verification. Further unit-suite
coverage remains in D6.

Next: extend verified terrain preparation to scenery; admit scenery
collision; prepare/release terrain and scenery atomically around the player; migrate
all live state at origin changes; create the unscored regional host; qualify collision,
rendering, offline recovery and continuous flight before publishing a regional map.

References: [Rapier scene queries](https://rapier.rs/javascript3d/classes/World.html)
and [collider construction](https://rapier.rs/javascript3d/classes/ColliderDesc.html).
The implementation exercises the repository's pinned runtime rather than assuming
newer documented APIs are compatible.
