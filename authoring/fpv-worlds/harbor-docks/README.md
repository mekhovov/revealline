# Harbor Docks — initial scene checkpoint

An original fictional Ukrainian quay with one Quay check-in course, not a completed eight-course world. The supported portal gantry, closed container groups, raised service deck and waterside boundary form three readable flying spaces. Seven further challenges remain design work.

The first generated scene has 6,088 triangles, ten imported material batches, two original 256px maps and 38 solid records. Source GLB 620,516B; prepared GLB 619,848B and zero glTF validator errors. The one-course pack/ZIP round trip and 142 static collider-marker, support, expanded waypoint and swept-route checks pass. Actual renderer visual acceptance and both ordinary-mode completions are pending.

All playable land rests on a real platform at Y0–2m. Spawn is Y2.25m; the first landing names `platform-quay`. Water is visual at Y0.22m starting X43m, outside the playable maximum X40m. The visible boundary is continuous. No over-water physics or route is implied. Cosmetic attached lock bars/straps are not presented as flyable gaps.

The existing required `REVEALLINE_surface_coating` version1 opaque-finish capability provides fixed host-defined depth bias for exact canonical painted planes. Imported face regions are partitioned; no free numerical rendering state or new runtime code is introduced. Old unsupported hosts must refuse this capability. Low/Balanced/High, Pixel/shared appearance, grazing paint and shadow boundaries need actual visual review.

Original CC0 geometry/maps/lettering; see [design and reference](DESIGN.md) and [license](source/LICENSE.md). Encoding helpers adapt the project's own authoring utilities. No copied competitor assets or logos, new renderer style, physics changes, package ceiling changes or new unit coverage.

```sh
node authoring/fpv-worlds/harbor-docks/build-checkpoint.mjs NEW_DIRECTORY
node authoring/fpv-worlds/harbor-docks/qualify-scene.mjs EXACT_PACK NEW_RECEIPT.json
node authoring/fpv-worlds/harbor-docks/prepare-preview.mjs EXACT_ADMITTED_102_PLAYER GENERATED_DIRECTORY NEW_PREVIEW_DIRECTORY
```

The static preview authenticates every complete admitted player byte and uses that renderer unchanged. Named views show the arrival apron, closed containers, gantry, service deck, water boundary, grazing apron and wide/overview/chase composition. These are manual observations, not flights or performance measurements. Freeze the final shared scene before all eight routes and sixteen fresh exact-pack proofs.
