# Alpine visual contour correction

The integrated review-r1 Overview exposed a real authored edge defect. Snow was selected by the centre height of each complete 8 m terrain square. This painted vertices up to 33.738 m below the 480 m snowline and left vertices up to 47.732 m above it uncovered. The previous material depth bias correctly removed coplanar interference; it could not repair this geometric mask boundary.

The opt-in `contours` authoring variant produces a new `relief-r2-contours` source. It clips each original canonical terrain triangle at the actual 330 m scree and 480 m snow contours, triangulates only the visual polygons, and samples the exact terrain plane again after horizontal millimetre quantization. The existing +3 mm visual offset and selective depth material remain. There are no new physical surfaces or changed terrain heights.

All 512 original terrain payloads remain byte-identical. All solid scenery surface vertices, indices and material bindings remain exact; so do the existing road, meltwater and reservoir surfaces. The terrain manifest revision changes only to pair with the new scenery revision. Old sources, immutable deliveries, installed revisions and Library pins are retained. The default generator still produces the original relief-r1 output.

This is a bounded contour-edge correction. Sparse conical scenery, simplistic mountain architecture and overall representative Alpine art remain unfinished. It neither promotes the new source into the Library nor qualifies final beauty, every possible flight path, hardware FPS or offline delivery.

## Reproduce and verify

```sh
node authoring/fpv-worlds/regions/alpine-highlands/prepare.mjs /new/output contours
node authoring/fpv-worlds/regions/alpine-highlands/verify-contours.mjs /original/relief-r1 /new/output
node authoring/fpv-worlds/regions/alpine-highlands/verify.mjs /new/output
node authoring/fpv-worlds/regions/alpine-highlands/verify-flight.mjs /new/output
```

The source uses the existing strict terrain/scenery manifests and 64 MiB source ceiling. It contains 104 scenery cells and 152 explicitly empty cells; its measured maximum nine-cell resource allocation is 1,040,912 bytes, or 2,081,824 bytes for retained plus candidate windows. Source bytes total 21,644,516. Native visual comparison is a separate gate and remains pending until recorded explicitly.

Verified results: 512 exact terrain payloads, 28 exact solid surface groups and seven unchanged other visual groups. The new contours contain 8,164 interpolated vertices; their largest canonical-plane error is 0.501 mm and height-threshold overshoot is 4 mm from quantization, replacing the previous tens-of-metres whole-square overshoot. All 360 canonical GLBs validate without errors or warnings; 480 terrain seams, 1,578 clear probes, 546 transitions and zero-resource disposal pass. All 258 existing commanded routes plus twelve authored starts pass through the production regional session. Regenerating the default legacy variant reproduces all 722 old files byte-for-byte.

Two explicit authoring comparison views expose the snow and scree boundaries from above. They do not replace normal-player Overview acceptance or the separate altitude-framing fix.

The first native comparison on isolated 9139 confirmed that clipping removes the old square snow staircase, but both preserved sources displayed green depth speckles in the distant authoring camera. That comparison retained the close-range 0.1 m near plane with a 2000 m far range; it is preserved as a negative, not accepted visual evidence. The initially chosen Scree view also failed to show the actual 330 m boundary.

The authoring-only follow-up gives the two explicitly marked contour Overview views a conservative near plane from the actual resident geometry envelope, capped at 10 m with a fourfold foreground margin. Close pilot and other authored views retain the 0.1 m/1400 m defaults. The Scree camera now looks at the measured 330 m slope near (1740, 1100). Both old and new sources remain unchanged and use the same camera/material for comparison. The production renderer and Library pins are untouched.

The preview-depth verifier checks both exact source identities, both comparison views and four viewport aspects: 260,716 actual vertices across 16 cases remain inside the depth range; all cases show both sides of the intended contour, and the new source has at least 90 visible clipped boundary vertices per case. The nearest actual geometry is 673 m away while the near plane stays 10 m. Estimated 24-bit depth precision improves 100.5-fold versus the old preview. This numerical estimate is not a GPU timing or native visual result. New isolated 9142 still requires native review.
