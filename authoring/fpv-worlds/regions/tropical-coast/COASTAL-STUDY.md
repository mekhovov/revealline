# Tropical coast: bounded first flight region

This original 384 × 384 m coastal layout turns the eight verified Ron Kapaun / 3TD Studios CC0 assets into an exact paired regional source. It is a review candidate, not a finished archipelago or a default Library admission.

## What is included

Nine 128 m cells share a continuous beach, shallow seabed and rolling dune height lattice. Forty deliberate placements provide two jetties, a stilt hut, four palms, bamboo clusters, grass, shoreline rocks and cargo. The source contains 9,306 scenery triangles and 18 unique derived textures. The original intake GLBs remain byte-identical.

The three authored starting points are a shoreline overlook, the covered-pier approach and the hut approach. Six commanded practice lines cover a long cross-cell shoreline flight, a covered pier opening, the space below its deck, a palm slalom, a bamboo corridor and braking around cargo. These are verified authoring routes; they are not scored missions or ghost recordings in the player.

The sea is a visual surface at 0 m above the actual solid seabed. It does not add buoyancy, water collision or drowning/damage behavior. Its plane and named foliage surfaces are explicitly visual-only; palm/bamboo trunks, all hut materials (including cutout planks/thatch), decks, roofs, rocks and crates stay solid. A cutout material never automatically means “no collision.”

## Reproduction

Use the existing authoring dependencies plus Python with Pillow. Choose NEW output directories for each command; source and prior outputs are not overwritten.

```sh
node authoring/fpv-worlds/regions/tropical-coast/prepare-rgba-review.mjs NEW_DERIVED_DIRECTORY PYTHON_WITH_PILLOW all
node authoring/fpv-worlds/regions/tropical-coast/prepare-coastal.mjs NEW_DERIVED_DIRECTORY NEW_REGION_DIRECTORY
node authoring/fpv-worlds/regions/tropical-coast/verify-coastal.mjs NEW_REGION_DIRECTORY
node authoring/fpv-worlds/regions/tropical-coast/verify-commanded-flight.mjs NEW_REGION_DIRECTORY
node authoring/fpv-worlds/regions/prepare-delivery.mjs NEW_REGION_DIRECTORY NEW_DELIVERY_DIRECTORY tropical-coastal-study review-r1
```

Only the explicit eight-model intake is supported. Each embedded texture is derived separately at 128 × 128 using Pillow LANCZOS; source tint, alpha cutoff, normals, UVs and double-sidedness remain. Exact duplicate position/normal/UV/RGBA tuples are welded only in the all-model regional path. This removes duplicate vertices without simplifying triangles, changing material boundaries or merging UV/hard-normal seams. The earlier two-model material review stays unchanged.

`coastal-preparation.json` pins both manifests, model/texture inputs, placement recipe and resource estimates. `delivery-review-r1/delivery.json` independently pins all 38 manifest/source/GLB files. The descriptor is 6,602 bytes, SHA-256 `ddd62d4662b873bc97243a414dc4ddc291eeb7e9c084f15af661b449ddcc3443`; its file closure is 5,982,641 bytes. No remote textures or runtime asset decoder are used.

## Functional evidence

`coastal-receipts-r1/` contains raw reports:

- 18 canonical GLBs validate with zero errors and zero warnings. A second output reproduces every source/scene/manifest byte.
- All six routes pass through production `createRegionalSession` in both Self-level and Acro: 12 runs, 29,224 fixed-step ticks total, no contacts, bounded cross-track and altitude error, and settled endpoints. The shoreline run crosses at least two cell boundaries. No body position is reassigned after the explicitly documented initial scenario spawn.
- All three authored starts prepare paused at tick zero in both modes. Arm before preparation fails; an explicit Arm is required. Paused input cannot move the state.
- Six actual body-contact runs verify palm trunks, cargo and an elevated pier roof in both modes. The falling body settles on the roof rather than passing to the terrain beneath it.
- Thirty exact collider probes cover both open pier passages, solid decks/roofs/trunks/hut/cargo, visual leaf canopy and visual sea at all three material tiers.
- Twenty-seven actual window replacements cover all nine cell centres at Performance, Balanced and Quality. Geometry, texture, source, reserved resources, collider counts and world counts are zero after disposal.

A full nine-cell window uses 955,344 geometry bytes and 2,599,580 texture bytes: 3,554,924 tracked resource bytes. Conservatively keeping both full retained and candidate windows requires 7,109,848 bytes, below the existing 8 MiB check. This includes texture source and GPU mip-chain estimates; it is not a measured total browser/GPU heap. No size or physics threshold was raised.

The opt-in `tropical` terrain material uses original world-space sand/dune colour and fine grain. Performance omits noise sampling; Balanced adds near-field grain; Quality adds a finer grain layer. No tier displaces vertices or changes physics, source ownership or regional bounds.

## Attribution and remaining acceptance

Original models: Ron Kapaun / 3TD Studios, **3TD Tropical Environment Pack v2.0**, CC0-1.0. See [verified intake provenance](intake-v1/provenance.json), [license record](intake-v1/LICENSE.txt) and [source page](https://opengameart.org/content/3td-tropical-environment-pack-v20). The original archive, intake model hashes and conversion limitations are retained there. The procedural terrain, placement composition and sea plane are original project work.

Native source appearance passed at representative views in all three tiers: Balanced overview/pier/palms, Quality hut from both sides, and Performance beneath the pier. Textures/cutouts were visible, the native console was clean, and explicit disposal reported all tracked resources/worlds/colliders zero. This accepts the bounded source study; the broad scene is still sparse and the water is flat. Exact combined package/offline installation, ordinary Library download/Fly, and optional trusted tropical terrain selection remain separate admission gates. No device FPS, two-hour native flight, huge archipelago, complete hut-interior route or final-art claim is made by these functional reports. The wider archipelago remains a later content increment.
