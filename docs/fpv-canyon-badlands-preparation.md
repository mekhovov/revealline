# Canyon Badlands: representative authoring preparation

This increment prepares **768 × 768 metres** of original terrain, not a default playable map. It is the first representative for the planned natural-region quality standard. The **8.192 × 8.192 km** full region remains a target. Runtime regional streaming, real flight qualification and catalogue admission are separate gates.

## What is prepared

The authored landscape contains six districts: a broad arrival basin, terraced Red Mesa, Serpentine Gorge, Twin Buttes, a branching Split Ravine and Sunset Shelf. Twelve named terrain landmarks and three candidate spawn positions provide repeatable places for future routes and bookmarks. The buttes rise above the surrounding plateaus; the canyon has connected bends and a fork rather than repeated straight channels.

Three preliminary corridor studies exercise different pilot tasks:

| Study         | Length | Corridor width | Minimum sampled terrain clearance | Intended activity                                       |
| ------------- | -----: | -------------: | --------------------------------: | ------------------------------------------------------- |
| Basin circuit |  396 m |           16 m |                          22.000 m | Forgiving initial line, turns and landing approaches    |
| Gorge run     |  683 m |           12 m |                          20.428 m | Link bends and read the next terrain opening            |
| Fork run      |  256 m |            8 m |                          20.365 m | Choose the narrow branch and maintain a deliberate line |

These are geometric route studies, not completed lessons, gate objectives, demonstrations or proof recordings. The checker samples centre and both corridor edges at intervals no larger than one metre, against the actual prepared triangle lattice. It does not claim continuous swept-volume clearance or successful pilot flight.

The preparation produces 36 cells, 72 scene/collision assets, 73,728 terrain triangles and 1,625,685 source bytes. All 60 shared edges match exactly. Independent prepared-artifact verification passes 72 asset hashes, 36 canonical scene comparisons and 4,074 corridor samples. The existing terrain admission verifier also passes all 11 scenarios on the rebased main. Terrain elevation spans 6–155.728 m. The existing terrain compiler creates each visible GLB and collider from the same 4 m lattice; no separate decorative terrain can hide a collision discrepancy.

## Reproduction and review

Run from the repository with Node 20 or newer, providing a **new** destination directory (the builder refuses to overwrite an existing directory):

```sh
node authoring/fpv-worlds/regions/canyon-badlands/prepare.mjs /path/to/new-canyon-output
node authoring/fpv-worlds/regions/canyon-badlands/verify.mjs /path/to/new-canyon-output
```

The output contains `region.json`, `design.json`, `preparation.json`, `terrain/` and a self-contained `overview.html`. The overview is an authoring illustration of the same lattice, with an explicitly preview-only sandstone tint. It is not a screenshot of the shipped renderer. The canonical terrain material remains neutral until the regional appearance contract supports materials. The generator does not alter a player package or the catalogue.

Browser review of the generated overview confirmed six distinct elevation areas and readable basin, gorge and fork paths. This qualifies the geometry composition only: faceting and the single preview tint remain visible, and no production-art or physical flight acceptance is claimed.

The recovered generator reproduced all 76 previously generated files byte-for-byte after the temporary checkout disappeared. Outputs and the complete source archive remained on external storage. The published source is now kept in a durable worktree and Git.

## Sources and licensing

Terrain, district layout, channels, landmark locations and route studies are original authored content. They do not copy a competitor's map. [VelociDrone's scenery catalogue](https://www.velocidrone.com/scenery?dlc=20), including Red Valley, informed the choice of varied flight spaces, not geometry or assets.

The [Canyon Terrain Asset by loafbrr](https://opengameart.org/content/canyon-terrain-asset) is a separately retained **CC0 authoring source**. The exact 64,599,746-byte archive is pinned by SHA-256 in `source/receipt.json`; its original `README.txt` explicitly declares CC0. Its 945,596-byte GLB contains 160 meshes, 160 nodes and five materials, with no embedded images or required extensions. The original README and unmodified GLB are retained beside the receipt for subsequent selection and optimization. The original archive remains external and is not copied into the player.

No candidate rock/plant mesh is referenced by this terrain manifest, and no Godot Terrain3D/Proton Scatter add-on or preview HDRI is included. The source's model count is independently inventoried, not inferred from the publisher's description. Placement, normal/material quality, individual collision and route clearance remain required before these meshes become scenery.

## Remaining before a playable Canyon region

- Regional renderer/physics integration, input ownership and safe missing-chunk recovery.
- Regional materials, terrain normals/lighting, selected optimized CC0 rocks and plants, and explicit collision for each meaningful obstacle.
- Actual flight through the three corridors, reworked route pacing, alternate starts and calibrated challenge objectives.
- Expansion towards the large-region target with authored districts, not replicated filler or artificially rescaled geometry.
- Streaming seam, origin-shift and long-session stability; offline missing-section recovery and named-device performance.
- Protected package/publication checks and actual player launch before catalogue admission.

A heightfield cannot represent caves, overhangs or a bridge underside. Those need a separate reviewed scene/collision representation. This preparation does not imply that huge regions, full realistic art, physical-device performance or scored proof compatibility have passed.
