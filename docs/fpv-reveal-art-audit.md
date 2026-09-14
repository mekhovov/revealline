# FPV reveal artwork audit

This is a design assessment of the existing source artwork against the approved restrained Field Kit pixel direction. It does not change an asset, picture pin, campaign, save, source license, or quality stage. Open the [source review atlas](../authoring/design-atlas/reveal-audit.html) from a source checkout. It loads originals by their existing paths, and renders procedural scenes with the actual `createSceneArt` helper at preview seed 0. No original image is copied into the atlas or production directory.

## Verified inventory

| Item                                         | Count |
| -------------------------------------------- | ----: |
| Exact required FPV picture owners            |    56 |
| Raster owner records                         |    39 |
| Unique raster PNG hashes and source paths    |    21 |
| Procedural owners                            |    17 |
| Playable First Light archive owners          |    12 |
| Non-archive owners                           |    44 |
| Minimum proposed distinct scene compositions |    38 |
| Exact frame exports for those compositions   |    44 |

Raster owners comprise 12 archive, 9 built-in, 6 optional and 12 external entries. Procedural owners comprise 12 First Signal base entries, 4 Fieldcraft entries and 1 Sentinel Relay entry. Every unique raster hash has at least one non-archive owner. The three First Light originals each have five owners: four playable historical revisions and the current revision. Homeward and Frontier share three originals; optional and external Pressure share three more. These are existing shared subjects, not missing new images.

All 21 unique rasters were visually inspected on contact sheets; Orchard Window, Homeward village, Frayed Causeway and Sandbar Braid were also inspected at full source resolution. All 17 procedural images were rendered through the actual scene helper with the bundled Canvas implementation and visually inspected at native 384×288. Browser rasterization may differ slightly at antialiased polygon edges. All raster byte hashes were checked against `CURRENT_ART_SOURCES`.

## Findings and classifications

The existing large illustrations are attractive pixel-painted scenes with useful local settings, strong landscape silhouettes and several distinctly Ukrainian environmental details. A broad color palette is not by itself an error in pixel art, and reveal pictures can be richer than the twelve-color player sprites. The reason for replacement is the approved **restrained, deliberate square-cluster** treatment and gameplay hierarchy: these illustrations use much finer irregular texture, substantial bloom/reflections and, frequently, a conspicuous static drone. Merely quantizing or shrinking these originals would lose their strengths and would not create a deliberately authored composition.

No image is marked “fits approved direction” without qualification or promoted to reviewed. All 21 raster groups are classified **needs replacement for new Field Kit presentation**, with their subjects retained as reference. The 12 archive owner records are classified **deliberately legacy retained for historical playback and earned originals**. This does not exempt those slots from the pipeline: a fresh Field Kit presentation may bind them to the same three new First Light compositions as current owners while their old exact pins remain unchanged. An already-earned original from any of the other 44 owners must likewise remain intact.

The procedural baseline has a larger identity gap. All 17 use the same dawn-village family, varied by seeded sun/hill/river placement and a windmill, house or bridge landmark. Even Switchyard Circuit and Sentinel Relay show this generic rural template. Their coarse shapes and quiet backgrounds fit the readability goal better, but their mission-specific content is incomplete. Classify all 17 **needs replacement** with individually authored compositions; a new seed or tint is not sufficient production work.

## Raster subjects and replacement briefs

### 01 · Orchard gate at sunset

[Original](../authoring/library/fpv-arcade/backgrounds/orchard-window.png) · 1774×887 · 5 owners · **needs replacement**.

Keep the blue gate, blossom frame, distant village and open path. Dense floral microtexture, many highlight colors and the baked flying quad compete with the restrained new scene language.

| Exact slot                     | Owner key / level / revision                                       | Source   | New frame |
| ------------------------------ | ------------------------------------------------------------------ | -------- | --------- |
| `picture.fpv.0e2d32dab758d51f` | `fpv-first-light/1/7109e646c73e09be` / `orchard-window` / `1`      | archive  | 1152×576  |
| `picture.fpv.1b418d3381494d1e` | `fpv-first-light-r4/4/0295a1eae3e180ec` / `orchard-window` / `4`   | archive  | 1152×576  |
| `picture.fpv.1c01a3257b18634c` | `fpv-first-light-r2/2/33e59e00d45542d4` / `orchard-window` / `2`   | archive  | 1152×576  |
| `picture.fpv.9c57dfab02314b3b` | `fpv-pressure-lines/1/ebb56ffdd9baa8e8` / `orchard-crossing` / `1` | built-in | 1152×576  |
| `picture.fpv.ee2bb3dc2c9fd05f` | `fpv-first-light-r3/3/73b6b5aed8595174` / `orchard-window` / `3`   | archive  | 1152×576  |

### 02 · River railway at sunset

[Original](../authoring/library/homeward-skies/backgrounds/homeward-02.png) · 1448×1086 · 2 owners · **needs replacement**.

Keep the railway crossing, river bend and station as this reward’s identity. Reduce bloom, sparkling water and foreground sunflower texture; separately compose the 4:3 and 2:1 frames.

| Exact slot                     | Owner key / level / revision                                         | Source   | New frame |
| ------------------------------ | -------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.0eb5ce0af7d9e254` | `homeward-skies/1/0d01f5687b3c38ff` / `homeward-02` / `1`            | built-in | 768×576   |
| `picture.fpv.76d2575817214ebd` | `fpv-pressure-frontier/1/b9387b2be34f51ff` / `river-frontiers` / `1` | built-in | 1152×576  |

### 03 · Broken island causeway

[Original](../authoring/library/fracture-lines-art/originals/frayed-causeway-fpv.png) · 1774×887 · 1 owners · **needs replacement**.

Keep the broken crossing and three island structures. The large foreground quad, realistic rock texture and dense reflections dominate the small gameplay actors.

| Exact slot                     | Owner key / level / revision                                                     | Source   | New frame |
| ------------------------------ | -------------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.144ce9c31afe2f45` | `fracture-lines-fpv/1/8f79476cc9cf6221` / `fracture-lines-frayed-causeway` / `1` | external | 1774×887  |

### 04 · Mountain radar station

[Original](../authoring/library/sentinel-circuit-art/originals/open-the-circuit.png) · 1774×887 · 1 owners · **needs replacement**.

Keep the large off-center dish and mountain ridge. Simplify metallic detail, scattered lamps and sky glow; separate any narrative aircraft from active gameplay cues.

| Exact slot                     | Owner key / level / revision                                                          | Source   | New frame |
| ------------------------------ | ------------------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.213f02450431334d` | `sentinel-circuit-fpv/1/398c82081d2d49df` / `sentinel-circuit-fpv-open-circuit` / `1` | external | 1774×887  |

### 05 · Night observatory

[Original](../authoring/library/fpv-arcade/backgrounds/night-signal.png) · 1774×887 · 5 owners · **needs replacement**.

Keep the observatory dome, quiet mountain horizon and aurora. Reduce bright stars and glow around the baked quad; reserve the clearest cyan/amber accents for gameplay.

| Exact slot                     | Owner key / level / revision                                      | Source   | New frame |
| ------------------------------ | ----------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.3a2d993531f58afb` | `fpv-first-light-r2/2/33e59e00d45542d4` / `night-signal` / `2`    | archive  | 1152×576  |
| `picture.fpv.87e45e757b0bb368` | `fpv-first-light-r3/3/73b6b5aed8595174` / `night-signal` / `3`    | archive  | 1152×576  |
| `picture.fpv.88a99ab27c50006d` | `fpv-first-light-r4/4/0295a1eae3e180ec` / `night-signal` / `4`    | archive  | 1152×576  |
| `picture.fpv.efccb4b013c76322` | `fpv-pressure-lines/1/ebb56ffdd9baa8e8` / `night-crossfire` / `1` | built-in | 1152×576  |
| `picture.fpv.f42f426a56bf26ac` | `fpv-first-light/1/7109e646c73e09be` / `night-signal` / `1`       | archive  | 1152×576  |

### 06 · Offset lake docks

[Original](../authoring/library/countercurrent-art/originals/offset-docks-fpv.png) · 1774×887 · 1 owners · **needs replacement**.

Keep opposed docks and broad water space. Replace irregular wood and water microtexture with larger clusters; the left/right silhouette is a valuable distinctive composition.

| Exact slot                     | Owner key / level / revision                                                  | Source   | New frame |
| ------------------------------ | ----------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.4673612d986703b5` | `countercurrent-fpv/1/7359effa888ca945` / `countercurrent-offset-docks` / `1` | external | 1774×887  |

### 07 · Industrial switchyard

[Original](../authoring/library/sentinel-circuit-art/originals/switchyard-gates.png) · 1774×887 · 1 owners · **needs replacement**.

Keep the rail gantries and converging gates. Simplify rail reflections and foreground equipment; avoid a prominent static quad that resembles the playable craft.

| Exact slot                     | Owner key / level / revision                                                              | Source   | New frame |
| ------------------------------ | ----------------------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.4c2e50e6a5e5a496` | `sentinel-circuit-fpv/1/398c82081d2d49df` / `sentinel-circuit-fpv-switchyard-gates` / `1` | external | 1774×887  |

### 08 · Homeward village

[Original](../authoring/library/homeward-skies/backgrounds/homeward-01.png) · 1448×1086 · 2 owners · **needs replacement**.

Keep the hillside cottages, apple tree and distant river. This is strong Ukrainian place imagery, but its dense illustrative highlights and broad palette need a new restrained pixel treatment.

| Exact slot                     | Owner key / level / revision                                           | Source   | New frame |
| ------------------------------ | ---------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.56f0db7a71aca759` | `homeward-skies/1/0d01f5687b3c38ff` / `homeward-01` / `1`              | built-in | 768×576   |
| `picture.fpv.f52fcf25066115d4` | `fpv-pressure-frontier/1/b9387b2be34f51ff` / `copper-switchyard` / `1` | built-in | 1152×576  |

### 09 · Night beacon hill

[Original](../authoring/library/homeward-skies/backgrounds/homeward-03.png) · 1448×1086 · 2 owners · **needs replacement**.

Keep the beacon, winding river and distant town. This is a strong quiet composition; reduce moon bloom, glitter and detailed foreground embroidery for consistent pixel scale.

| Exact slot                     | Owner key / level / revision                                     | Source   | New frame |
| ------------------------------ | ---------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.6cd39fc2a7838c93` | `homeward-skies/1/0d01f5687b3c38ff` / `homeward-03` / `1`        | built-in | 768×576   |
| `picture.fpv.e0bd881f88854aa3` | `fpv-pressure-frontier/1/b9387b2be34f51ff` / `last-beacon` / `1` | built-in | 1152×576  |

### 10 · Sunlit courtyard exits

[Original](../authoring/library/fpv-pressure-art/originals/courtyard-exits.png) · 1774×887 · 2 owners · **needs replacement**.

Keep the mill arches and open exits. Replace tiny brick and flower texture, glowing reflections and the conspicuous flying quad with larger readable forms.

| Exact slot                     | Owner key / level / revision                                                                              | Source   | New frame |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.6ebb069a27747f79` | `original-fpv-pressure-lines/1/b86804fb3ab94151` / `original-fpv-courtyard-exits` / `1`                   | optional | 1152×576  |
| `picture.fpv.b6fe74b07d509a5f` | `original-fpv-pressure-lines-external/1/60d1f9c4f1304d7d` / `original-fpv-courtyard-exits-external` / `1` | external | 1774×887  |

### 11 · Night industrial waterway

[Original](../authoring/library/fpv-pressure-art/originals/night-crossfire.png) · 1774×887 · 2 owners · **needs replacement**.

Keep the blue lock basin, bridge and warm window rhythm. Reduce luminous microdetail and the flying quad so cable and threat silhouettes remain dominant.

| Exact slot                     | Owner key / level / revision                                                                              | Source   | New frame |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.701500506246c7fd` | `original-fpv-pressure-lines/1/b86804fb3ab94151` / `original-fpv-night-crossfire` / `1`                   | optional | 1152×576  |
| `picture.fpv.bcff9f990784a0f3` | `original-fpv-pressure-lines-external/1/60d1f9c4f1304d7d` / `original-fpv-night-crossfire-external` / `1` | external | 1774×887  |

### 12 · Rainy split courtyard

[Original](../authoring/library/fpv-arcade/backgrounds/split-courtyard.png) · 1774×887 · 5 owners · **needs replacement**.

Keep the paired gateways, split building masses and rainy mood. Dense wet reflections and a center quad need a calmer new treatment; do not lose the recognizable split silhouette.

| Exact slot                     | Owner key / level / revision                                      | Source   | New frame |
| ------------------------------ | ----------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.719af689f36f22ac` | `fpv-first-light-r2/2/33e59e00d45542d4` / `split-courtyard` / `2` | archive  | 1152×576  |
| `picture.fpv.7559fb204cb162af` | `fpv-first-light/1/7109e646c73e09be` / `split-courtyard` / `1`    | archive  | 1152×576  |
| `picture.fpv.8291ed03ac5ac19e` | `fpv-first-light-r4/4/0295a1eae3e180ec` / `split-courtyard` / `4` | archive  | 1152×576  |
| `picture.fpv.9cd8a63c5dd341ef` | `fpv-first-light-r3/3/73b6b5aed8595174` / `split-courtyard` / `3` | archive  | 1152×576  |
| `picture.fpv.c123b9065e7d1d0a` | `fpv-pressure-lines/1/ebb56ffdd9baa8e8` / `courtyard-exits` / `1` | built-in | 1152×576  |

### 13 · Listening relay court

[Original](../authoring/library/sentinel-circuit-art/originals/listening-court.png) · 1774×887 · 1 owners · **needs replacement**.

Keep the low walled court, relay masts and off-center service van. Replace finely shaded foliage, mud and hardware with deliberate clusters; distinguish this from the radar-dish scene.

| Exact slot                     | Owner key / level / revision                                                             | Source   | New frame |
| ------------------------------ | ---------------------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.758214a2ee21bb30` | `sentinel-circuit-fpv/1/398c82081d2d49df` / `sentinel-circuit-fpv-listening-court` / `1` | external | 1774×887  |

### 14 · Moonlit crossing watch

[Original](../authoring/library/countercurrent-art/originals/crossing-watch-fpv.png) · 1774×887 · 1 owners · **needs replacement**.

Keep the beacon on the left and workshop on the right framing water. Quiet center composition fits the hierarchy; realistic moonlight/reflection texture still needs the new pixel treatment.

| Exact slot                     | Owner key / level / revision                                                    | Source   | New frame |
| ------------------------------ | ------------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.77556da2651efacd` | `countercurrent-fpv/1/7359effa888ca945` / `countercurrent-crossing-watch` / `1` | external | 1774×887  |

### 15 · Orchard water crossing

[Original](../authoring/library/fpv-pressure-art/originals/orchard-crossing.png) · 1774×887 · 2 owners · **needs replacement**.

Keep diagonal orchard rows, the arch crossing and poplar silhouettes. Simplify leaves, masonry and mist; remove the prominent foreground quad from the gameplay reading area.

| Exact slot                     | Owner key / level / revision                                                                               | Source   | New frame |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.7a7abd48fa2dfc82` | `original-fpv-pressure-lines/1/b86804fb3ab94151` / `original-fpv-orchard-crossing` / `1`                   | optional | 1152×576  |
| `picture.fpv.899a33d8cd714962` | `original-fpv-pressure-lines-external/1/60d1f9c4f1304d7d` / `original-fpv-orchard-crossing-external` / `1` | external | 1774×887  |

### 16 · Circular silo yard

[Original](../authoring/library/fracture-lines-art/originals/split-ring-fpv.png) · 1774×887 · 1 owners · **needs replacement**.

Keep the round silo landmark and split track. Reduce realistic metal/mud texture and large foreground drone; retain the circular silhouette so it differs from other depot scenes.

| Exact slot                     | Owner key / level / revision                                                | Source   | New frame |
| ------------------------------ | --------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.8876473e40d70804` | `fracture-lines-fpv/1/8f79476cc9cf6221` / `fracture-lines-split-ring` / `1` | external | 1774×887  |

### 17 · Forked factory yard

[Original](../authoring/library/fracture-lines-art/originals/fault-fan-fpv.png) · 1774×887 · 1 owners · **needs replacement**.

Keep the fan of rails and two workshop masses. Simplify pipes, wet tracks and scattered lamps; this must remain a rail-fan composition rather than a recolored depot.

| Exact slot                     | Owner key / level / revision                                               | Source   | New frame |
| ------------------------------ | -------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.a8046be4fe21bb4d` | `fracture-lines-fpv/1/8f79476cc9cf6221` / `fracture-lines-fault-fan` / `1` | external | 1774×887  |

### 18 · Signal foundry

[Original](../authoring/library/challenge-chapter-art/originals/split-signal-foundry.png) · 1774×887 · 1 owners · **needs replacement**.

Keep tall brick foundry, lower workshop and signal mast. Reduce tiny rail/brick reflections and foreground quad detail; use a distinct narrow central opening.

| Exact slot                     | Owner key / level / revision                                           | Source   | New frame |
| ------------------------------ | ---------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.adf5c9eea274ba7f` | `fpv-route-choices/1/4a7f15a0b07d557d` / `route-choices-foundry` / `1` | optional | 1152×576  |

### 19 · Crosswind field depot

[Original](../authoring/library/challenge-chapter-art/originals/crosswind-depot.png) · 1774×887 · 1 owners · **needs replacement**.

Keep the farm sheds framing a windy field. Reduce dense leaves, sunflowers and muddy detail; the off-center shed silhouettes and open horizon are worth preserving.

| Exact slot                     | Owner key / level / revision                                         | Source   | New frame |
| ------------------------------ | -------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.c3d85f08209b7de8` | `fpv-route-choices/1/4a7f15a0b07d557d` / `route-choices-depot` / `1` | optional | 1152×576  |

### 20 · Winter signal switchback

[Original](../authoring/library/challenge-chapter-art/originals/signal-switchback.png) · 1774×887 · 1 owners · **needs replacement**.

Keep snow, winding hillside road and relay mast. Preserve the only winter biome; replace photographic snow/branch texture and the foreground quad with crisp clustered masses.

| Exact slot                     | Owner key / level / revision                                              | Source   | New frame |
| ------------------------------ | ------------------------------------------------------------------------- | -------- | --------- |
| `picture.fpv.fb5413f595ab2c5b` | `fpv-route-choices/1/4a7f15a0b07d557d` / `route-choices-switchback` / `1` | optional | 1152×576  |

### 21 · Braided sandbar delta

[Original](../authoring/library/countercurrent-art/originals/sandbar-braid-fpv.png) · 1774×887 · 1 owners · **needs replacement**.

The strongest negative-space reference: preserve broad channels and offset sandbars. Simplify surface sparkle, haze, tiny reeds and aircraft into restrained clusters while retaining the unique delta layout.

| Exact slot                     | Owner key / level / revision                                                   | Source   | New frame |
| ------------------------------ | ------------------------------------------------------------------------------ | -------- | --------- |
| `picture.fpv.fd78a9a977bd419b` | `countercurrent-fpv/1/7359effa888ca945` / `countercurrent-sandbar-braid` / `1` | external | 1774×887  |

## Procedural subjects

All current source frames are 384×288. Each row requires its own reviewed composition, even when it reuses a shared environment kit.

| Exact slot and owner                                                                                                                           | New subject                                                           | New frame |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------- |
| `picture.fpv.0f5828ed32e61eea` · First Signal · The Crossing · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-07` / `1`               | Short river crossing with separated banks                             | 768×576   |
| `picture.fpv.11b817ad76f073e5` · First Signal · Relay Orchard · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-02` / `1`              | Distinct orchard rows with a relay at the far corner                  | 768×576   |
| `picture.fpv.15ad2393da53b1f3` · First Signal · Stone Lanes · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-04` / `1`                | Stone-walled lanes with a clear central turn                          | 768×576   |
| `picture.fpv.21af5a140bffb67a` · First Signal · Supply Circuit · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-10` / `1`             | Supply sheds around a service loop                                    | 768×576   |
| `picture.fpv.26e53164613e83d0` · First Signal · First Signal · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-01` / `1`               | First field launch with a small relay hut and one open horizon        | 768×576   |
| `picture.fpv.4166a190ab3ddec3` · Fieldcraft · Switchyard Circuit · FPV Front · `fieldcraft/1/96ae746769a8b440` / `fieldcraft-02` / `1`         | Actual rail switchyard, gates and track crossings                     | 768×576   |
| `picture.fpv.42bce3db8b1e603a` · Fieldcraft · Copper Crossing · FPV Front · `fieldcraft/1/96ae746769a8b440` / `fieldcraft-01` / `1`            | Copper-colored bridge with asymmetric abutments                       | 768×576   |
| `picture.fpv.493d624384c36c39` · First Signal · Hidden Frequency · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-06` / `1`           | Secluded antenna behind a wooded ridge                                | 768×576   |
| `picture.fpv.628455cefcf758d6` · Sentinel Relay · Sentinel Relay · FPV Front · `sentinel-relay/1/838c4e06647f7fd0` / `sentinel-relay-01` / `1` | Large guarded relay compound with a recognizable central dish         | 768×576   |
| `picture.fpv.6a200fa6fc2c6c98` · First Signal · Signal Garden · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-09` / `1`              | Garden plots around a tiny weather/relay station                      | 768×576   |
| `picture.fpv.6a7fe94b1cf0ab84` · Fieldcraft · Pulse Recall · FPV Front · `fieldcraft/1/96ae746769a8b440` / `fieldcraft-03` / `1`               | Relay mast reflected in a compact still-water court                   | 768×576   |
| `picture.fpv.89f500bf737786b4` · First Signal · Night Patrol · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-05` / `1`               | Night outpost with restrained warm windows and a low moon             | 768×576   |
| `picture.fpv.95c0dfa75cc8f037` · First Signal · Last Light · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-08` / `1`                 | Last-light hill with the sun near the horizon                         | 768×576   |
| `picture.fpv.b31039b52e366575` · Fieldcraft · Net Loom · FPV Front · `fieldcraft/1/96ae746769a8b440` / `fieldcraft-04` / `1`                   | Cable workshop with drying racks and broad structural silhouettes     | 768×576   |
| `picture.fpv.c2db06198f371c49` · First Signal · Short Fuse · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-11` / `1`                 | Compact maintenance yard with one amber workbench accent              | 768×576   |
| `picture.fpv.eed5c579750a6e66` · First Signal · Crosswind · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-03` / `1`                  | Wind across a diagonal field, leaning grass and an off-center shelter | 768×576   |
| `picture.fpv.f0b0d70327a0a4c4` · First Signal · Relay Storm · FPV Front · `first-signal/2/88639f3aab7b6cc1` / `signal-12` / `1`                | Storm clouds over a distinct twin-mast relay ridge                    | 768×576   |

## Minimal coherent production set

Build one original environment kit with seven reusable families: village/stone lanes, orchard/field, courtyard, industrial rail/depot, river/delta, relay/night, and winter. Keep a shared ink/teal foundation, warm light and restrained pale/cyan accents. Environmental green, earth and snow may extend the sprite palette in controlled ramps. Reuse trees, walls, sheds, water shapes and signal hardware; author each composition’s horizon, foreground frame, landmark and open-space pattern deliberately.

Produce **38 distinct compositions**, not 56 independent paintings or seven repeated backgrounds: the 21 existing raster subjects plus 17 named procedural mission subjects. Reusing the already-shared subject across exact owner records preserves current content relationships. Keep the winter road, sandbar braid, round silo, large radar dish, observatory dome and paired courtyard gates distinct; these must not become generic house/river scenes with different seeds.

Those 38 compositions need **44 exact frame exports**. Homeward’s three compositions each need 768×576 and 1152×576 versions. Pressure’s three each need 1152×576 and 1774×887 versions. All other compositions use their single registered frame. Compose both aspect ratios independently for Homeward; do not crop away the identifying landmark. Derive 768×576 from a deliberate 384×288 grid and 1152×576 from 384×192 with integer enlargement. For external 1774×887 frames, draw intentional integer clusters directly into the exact frame, with bounded edge cells; avoid fractional stretching. Source image dimensions and slot export dimensions are deliberately separate columns in the atlas.

Sequence work in three reviewable batches:

1. **Style proof:** orchard gate, night observatory, river delta and one new First Signal scene. Check enlarged cluster structure, 240 px gallery thumbnails, full reveal and partially exposed actual boards. Confirm the new work is at least as rewarding as the existing pictures.
2. **Shared raster families:** complete the remaining 18 raster subjects and the additional aspect/size variants. Validate every owner mapping, exact frame and hash; retain all original files and source pins.
3. **Mission identity completion:** author the remaining 16 procedural subjects from the actual mission names/briefs. Check that a player can distinguish successive earned pictures without reading their labels.

The style proof counts one procedural and three raster compositions; its completion leaves 18 raster and 16 procedural compositions. Every stage records actual outputs and evidence. Existing source art, source wrappers and seed variations must not be counted as newly produced or reviewed assets.

## Acceptance and preservation

- Register new immutable asset and presentation revisions for every exact slot. Do not change map/campaign identity to deliver cosmetic art. Do not mutate a previously earned image or replay pin.
- Keep original hashes, dimensions, fit, byte source and provenance accessible through the current-art adapter. Source-only review links are not release dependencies.
- Require exact registered frame size, bounded PNG bytes, opaque image coverage, deterministic exports and a distinct composition identifier. Record native design grid, scale and any separate derivative operation honestly.
- Keep text, active actors, boundary markers, pickups and trails outside pictures. Environmental props may suggest FPV work, but a large decorative quad should not resemble an active target inside the field.
- Review title/gallery, picture viewer and real partially exposed boards at representative phone and desktop sizes, Standard/Large text and Reduced effects. Player center, unfinished cable and imminent threat silhouettes remain first in the visual hierarchy.
- Review the full original-picture path: old collection item, existing flight, replay, freshly started mission, offline/absent external source and imported theme. A new presentation must not silently rewrite historical rewards.

The [machine-readable audit](../authoring/design-atlas/reveal-audit.json) contains every full source hash, path, owner identity, source dimension, required slot dimension, classification and proposed subject. It is an audit snapshot, not a replacement runtime registry or a review approval.

The [flattened production plan](../authoring/design-atlas/reveal-production-plan.json) lists all 38 composition IDs and all 44 exact exports with their complete 56-owner mapping. Every entry is explicitly planned.
