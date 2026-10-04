# Harbor Docks — initial scene checkpoint

An original fictional Ukrainian quay with one Quay check-in course, not a completed eight-course world. The supported portal gantry, closed container groups, raised service deck and waterside boundary form three readable flying spaces. Seven further challenges remain design work.

The revised r2 scene has 7,900 triangles, ten imported material batches, two original 256px maps and 38 solid records. Source GLB 761,036B; prepared GLB 760,368B and zero glTF validator errors. The one-course pack/ZIP round trip and 148 static collider-marker, support, expanded waypoint, swept-route and serialized-water checks pass. A separate 23-check r1/r2 comparison preserves every course field except revision, all markers/colliders and both embedded PNG byte streams. Revised-scene visual acceptance and both ordinary-mode completions are pending.

The r1 actual renderer review retained eight views, no errors and disposed all registered resources. Closed containers and the supported gantry were accepted as foundations; the full scene needed a coherent water background, a shaped barge and less blank service-deck paint. The Pixel container capture was retained but not personally visually accepted. That historical review and screenshots remain in `evidence/r1-static/`; its 6,088-triangle assets and 142-check survey are unchanged.

r2 extends water beyond the review frusta and around the quay ends, shapes the original barge bow/stern with cabin glazing and deck rails, and partitions the existing closed service facade/roof/deck into opaque paint regions. It adds 1,812 triangles, no imported material or image owner, and no collision or route change. Before/after camera positions remain matched; new vessel and deck-roof views are static inspection aids outside gameplay, not additional playable space.

All playable land rests on a real platform at Y0–2m. Spawn is Y2.25m; the first landing names `platform-quay`. Water is visual at Y0.22m starting X43m, outside the playable maximum X40m; north/south background water also stays beyond the quay ends and playable Z bounds. Each serialized water triangle is checked against that contract. The visible east boundary is continuous. No over-water physics or route is implied. Cosmetic attached lock bars/straps are not presented as flyable gaps.

The existing required `REVEALLINE_surface_coating` version1 opaque-finish capability provides fixed host-defined depth bias for exact canonical painted planes. Imported face regions are partitioned; no free numerical rendering state or new runtime code is introduced. Old unsupported hosts must refuse this capability. Low/Balanced/High, Pixel/shared appearance, grazing paint and shadow boundaries need actual visual review.

Original CC0 geometry/maps/lettering; see [design and reference](DESIGN.md) and [license](source/LICENSE.md). Encoding helpers adapt the project's own authoring utilities. No copied competitor assets or logos, new renderer style, physics changes, package ceiling changes or new unit coverage.

```sh
node authoring/fpv-worlds/harbor-docks/build-checkpoint.mjs NEW_DIRECTORY
node authoring/fpv-worlds/harbor-docks/qualify-scene.mjs EXACT_PACK NEW_RECEIPT.json
node authoring/fpv-worlds/harbor-docks/qualify-refinement.mjs R1_DIRECTORY R2_DIRECTORY NEW_RECEIPT.json
node authoring/fpv-worlds/harbor-docks/prepare-preview.mjs EXACT_ADMITTED_102_PLAYER GENERATED_DIRECTORY NEW_PREVIEW_DIRECTORY
```

The static preview authenticates every complete admitted player byte and uses that renderer unchanged. Named views show the arrival apron, closed containers, gantry, service deck, water boundary, grazing apron and wide/overview/chase composition. These are manual observations, not flights or performance measurements. Freeze the final shared scene before all eight routes and sixteen fresh exact-pack proofs.
