# Desert Expedition: original 16.384 km natural-terrain study

This source explores six different landforms in one continuous 16,384 × 16,384 m heightfield. It is an authoring study, not a Library entry, finished artwork, or an unlimited world. The 32 × 32 lattice uses the opt-in 512 m cell capability: each cell still contains 33 × 33 samples, so natural terrain samples are 16 m apart. The existing 64 MiB delivery and bounded resident-window limits stay unchanged.

The design is original analytic terrain, not scaled Canyon geometry, a tiled asset pack, or a reconstruction of a real place. No external model, height map, image, or texture is included. Existing Canyon and other source revisions remain untouched.

## Composition and flight purpose

| District           | Shape                                                                       | Intended flight practice                                                |
| ------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Crescent dunes     | Oblique asymmetric crests with unequal amplitudes and broad interdune lanes | Contour following, crest crossing, choosing smooth paths between ridges |
| Dry wash           | Continuous curving drainage with a tributary and uneven shoulders           | Following a changing heading while holding clearance above the floor    |
| Salt basin         | Nearly level playa with a rising alluvial margin and a separate island      | Low smooth flight, orbiting a landmark, controlled shoreline climbs     |
| Sunrise escarpment | Long scarp with two unequal broad passes and a gradual toe slope            | Elevation changes, pass approaches, contour lines                       |
| Mesa corridor      | Two offset tablelands with broad shoulders and an open corridor             | Choosing between a lower route and a climb, sweeping turns              |
| Rocky plain        | Uneven pediment with four individually placed broad tors                    | Slalom, saddle crossing, landmark orientation                           |

Fourteen named relief landmarks are represented by the same terrain triangles used for collision. They are broad terrain forms, not detailed rock meshes or hollow arches. Twelve routes are explicitly authored; each has a 40 m-wide sampled clearance corridor, with target flight altitude 32 m above the canonical terrain. These are verification paths, not newly admitted scored missions. Six starting positions sit 3 m above the canonical surface and begin disarmed.

## References and provenance

The following primary references informed the relationship between landforms, not their geometry or assets:

- [NPS: Geology of White Sands](https://www.nps.gov/whsa/learn/geology-of-white-sands.htm) describes wind-driven accumulation of dunes from gypsum sediment. The study uses a localized, directional dune field with open lanes instead of generic terrain noise.
- [NPS: Badwater Basin](https://www.nps.gov/places/badwater-basin.htm) describes the salt flat left by an ancient evaporated lake. The study uses a low, nearly level basin whose shape contrasts with the surrounding relief.
- [NPS: Geologic Formations, Death Valley](https://home.nps.gov/deva/learn/nature/geologicformations.htm) identifies alluvial fan gravel and playa silt/salt. The study connects its low basin to broad rising margins and dry drainage rather than placing unrelated raised tiles.

References checked 15 October 2026. No reference imagery or source data is redistributed, and no claim of geological simulation or geographic accuracy is made.

## Reproduction

From a source checkout containing the optional 512 m capability:

```sh
node authoring/fpv-worlds/regions/desert-expedition/prepare-desert.mjs /new/external/output
node authoring/fpv-worlds/regions/desert-expedition/verify-desert.mjs /new/external/output
node authoring/fpv-worlds/regions/desert-expedition/verify-desert-flight.mjs /new/external/output
```

Preparation refuses an existing output directory. It writes canonical terrain GLB/collision pairs, exact manifest hashes, a sparse companion with explicit empty cells, sampled paths and a preparation receipt. Verification regenerates source bytes and every GLB, validates shared edges, checks real production support/sweeps and disposes resident resources. The separate flight check drives the shared flight authority with commands in self-level and Acro modes; it does not teleport between points within a route.

## Verified source scope

The generated terrain and explicit empty companion total **47,556,515 bytes** before a future delivery descriptor, within the unchanged 64 MiB ceiling. Two independent preparations produced the same manifests and all 2,048 source asset hashes.

[source-verification.json](./source-verification.json) records 1,024 canonical GLBs with zero validation warnings/errors, 1,984 exact shared edges, 188 representative/perimeter windows and 290 production window transitions. It also records 1,443 clear corridor sweeps, 14 actual terrain contacts at authored landmarks and six clear starts. Maximum resident geometry was 456,408 bytes across nine cells; disposal returned geometry to zero. This is geometry/resource ownership evidence, not total process memory or device FPS.

[flight-verification.json](./flight-verification.json) records all 24 route/mode cases completing through the actual shared flight authority: 735,397 ticks and 105 in-flight recentres, with zero route contacts. Maximum cross-track deviation was 0.461 m and maximum height error 0.547 m. All twelve authored-start/mode cases, four deliberate solid terrain contacts, pause isolation and resource disposal passed. The explicit empty companion made zero scenery asset requests. These are controlled-command representative routes, not a native pilot test or full-map endurance traversal.

## Remaining gates

- Sixteen-metre sampling deliberately omits fine dunes, cracks, rocks, narrow gaps, overhangs and close-up surface detail. Those need separately authored scenery or a future detail profile; no collision detail is fabricated in the shader.
- Material/art review, native player navigation, route readability from FPV, packaged/offline installation and extended device performance remain open.
- Source coverage is not proof of a full uninterrupted traversal or hours of finished gameplay. Representative route and resident-window evidence must be read at its stated scope.
- No delivery descriptor, immutable download bundle or Library row is added by this source increment.
