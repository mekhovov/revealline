# Canyon arrival relief revision

This optional authoring source revision rounds narrow ridges and abrupt slope transitions in the original Canyon terrain. It preserves the accepted r1 preparation and generates a separate r2 pair for the same bounded **384 × 384 m** arrival slice. Neither revision is a default playable map or a qualified package.

## Changed ground, matching collision

The original authored drainage path is retained. A fixed 5 × 5 binomial filter, with weights [1, 4, 6, 4, 1] on each axis and an 8 m radius, rounds the original heights on the existing lattice. Shared cell edges evaluate the same global source coordinates, including the surrounding samples. The format remains a 4 m heightfield: no extra tessellation, runtime generation, hidden collision approximation or material displacement is introduced.

Terrain heights intentionally change. Both canonical visible meshes and collision are regenerated from the same serialized heights and requalified together. The original 768 m terrain and previous 384 m sources are untouched. All 27 licensed rock mesh topologies, dimensions and colours are retained and regrounded to the revised terrain. All horizontal placements remain unchanged. The receipt records every old and new base/centre, and the verifier checks the exact vertical translations against the accepted source.

The three previously checked route definitions and original basin spawn remain. They are geometric clearance studies, not scored lessons or demonstration recordings.

## Exact output and checks

- Terrain manifest SHA-256: `9fad494a6dc1e974695e9fa218b99e74f1676d2589303c7ececea8728b106239`.
- Scenery manifest SHA-256: `a72ba600c11eba60486b645ca40967802498deb28e46dece02b10b3f04e0c30f`.
- 36 assets, 1,161,742 source bytes; 673,464 geometry bytes for the full nine-cell window.
- 7,425 changed serialized height entries, including shared cell-edge duplicates. Maximum raise 3.032 m and maximum lowering 9.165 m; the revised canyon is not claimed to preserve the old collision surface.
- Same 18,432 terrain triangles and 6,606 rock triangles as r1.
- 18 canonical GLBs with zero validator warnings/errors; seam checks and exact counterpart/source identity checks pass.
- 2,247 actual sphere sweeps through the centre and boundary lanes of the retained routes; 27 visible grounded rock support hits; clear original spawn; 100 shared-flight ticks followed by pause/dispose.
- Original r1 verifier also passes after adding the explicit relief verification mode. Source files remain unchanged and disposal returns resident geometry to zero.
- Independent regeneration produces 42 byte-identical files. The generator rejects any height change beyond the explicit 10 m study bound.

Measured from serialized heights on the same 18,050 horizontal/vertical profile hinges, changes over 30° decrease from 340 to 32. Maximum change decreases from 124.249° to 62.363°; mean change decreases from 2.404° to 2.241°. This describes a geometry continuity improvement, not perceptual acceptance, flight performance or a resolution increase.

```sh
node authoring/fpv-worlds/regions/canyon-badlands/prepare-relief.mjs /external/canyon-landmarks-r7 /external/canyon-relief-new
node authoring/fpv-worlds/regions/canyon-badlands/verify-landmarks.mjs /external/canyon-landmarks-r7 /external/canyon-relief-new relief
```

The optional inspection page accepts the new pair using `views=canyon`, `ground=canyon` and the existing lighting profile. No promoted runtime modules are changed.

Native browser comparison at 1280 × 800 confirmed softer Gorge ridge teeth with the drainage path retained. The Ridge crown remains grounded and its arch opening clear. Release removes live scenery/collision. This is a bounded relief improvement; periodic horizontal bands and some triangular lighting remain visible.

## Still unfinished

The periodic terrain bands and broad material treatment are unchanged. Some sharp ridge profiles remain at 4 m resolution. This revision does not establish the final representative art standard, increase world extent, add mission gameplay or qualify player/offline delivery. Canonical material changes must follow the coordinated runtime-module promotion; there is no parallel authoring-only shader fork.
