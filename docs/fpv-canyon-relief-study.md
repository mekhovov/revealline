# Canyon arrival relief revision

This optional authoring source revision addresses abrupt joins in the original Canyon drainage cuts. It preserves the accepted r1 preparation and generates a separate r2 pair for the same bounded **384 × 384 m** arrival slice. Neither revision is a default playable map or a qualified package.

## Changed ground, matching collision

The authored drainage controls now form a centripetal Catmull–Rom centreline sampled into bounded segments. Wider slope transitions and softly blended basin/plateau intersections reduce sudden changes of direction. The format remains a 4 m heightfield: no extra tessellation, runtime generation, hidden collision approximation or material displacement is introduced.

Terrain heights intentionally change. Both canonical visible meshes and collision are regenerated from the same serialized heights and requalified together. The original 768 m terrain and previous 384 m sources are untouched. All 27 licensed rock mesh topologies, dimensions and colours are retained and regrounded to the revised terrain. The wider channel reached the southern saddle formation; that one formation explicitly moves 22 m east and 16 m north onto the adjacent plateau. The receipt records every old and new base/centre, and the verifier checks those exact translations against the accepted source.

The three previously checked route definitions and original basin spawn remain. They are geometric clearance studies, not scored lessons or demonstration recordings.

## Exact output and checks

- Terrain manifest SHA-256: `2f8d45ce06be1b494a3a86b5745e94dd7a0ea03ca163cf21b12717028a500ec0`.
- Scenery manifest SHA-256: `31d45940011751e94ab40b57b5337dd7adb7e6f36a365c3328e07f2768bbb659`.
- 36 assets, 1,161,663 source bytes; 673,464 geometry bytes for the full nine-cell window.
- 4,088 changed serialized height entries, including shared cell-edge duplicates. Maximum raise 3.209 m and maximum lowering 39.793 m; the revised canyon is not claimed to preserve the old collision surface.
- Same 18,432 terrain triangles and 6,606 rock triangles as r1.
- 18 canonical GLBs with zero validator warnings/errors; seam checks and exact counterpart/source identity checks pass.
- 2,247 actual sphere sweeps through the centre and boundary lanes of the retained routes; 27 visible grounded rock support hits; clear original spawn; 100 shared-flight ticks followed by pause/dispose.
- Original r1 verifier also passes after adding the explicit relief verification mode. Source files remain unchanged and disposal returns resident geometry to zero.

Measured from serialized heights on the same 18,050 horizontal/vertical profile hinges, changes over 30° decrease from 340 to 210. Maximum change decreases from 124.249° to 118.801°; mean change decreases from 2.404° to 2.268°. This describes a modest geometry improvement, not perceptual acceptance, flight performance or a resolution increase.

```sh
node authoring/fpv-worlds/regions/canyon-badlands/prepare-relief.mjs /external/canyon-landmarks-r7 /external/canyon-relief-new
node authoring/fpv-worlds/regions/canyon-badlands/verify-landmarks.mjs /external/canyon-landmarks-r7 /external/canyon-relief-new relief
```

The optional inspection page accepts the new pair using `views=canyon`, `ground=canyon` and the existing lighting profile. No promoted runtime modules are changed.

## Still unfinished

The periodic terrain bands and broad material treatment are unchanged. Some sharp ridge profiles remain at 4 m resolution. This revision does not establish the final representative art standard, increase world extent, add mission gameplay or qualify player/offline delivery. Canonical material changes must follow the coordinated runtime-module promotion; there is no parallel authoring-only shader fork.
