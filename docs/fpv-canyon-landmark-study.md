# Canyon arrival landmark study

This optional authoring increment adds recognizable rock formations and foreground scale to a **384 × 384 m subset** of the existing 768 × 768 m Canyon terrain. The full terrain preparation remains intact. This is a bounded composition study, not an 8 km world, a default playable map, a recorded lesson or a qualified package.

## What changes

Twenty-seven individually placed rock meshes form nine small compositions: an arrival cairn, twin spires with an open approach, a mesa crown, basin exit, gorge entry, eastern overlook, western ridge, needle bend and southern saddle. Smaller rocks give the foreground scale. Three restrained sandstone bands distinguish the larger formations without adding textures or shader resources.

Every visible rock triangle is also a collision triangle. The generator copies all 18 terrain assets byte-for-byte from the accepted Canyon preparation and never smooths, displaces or replaces its 4 m heightfield. Source mesh positions are normalized, scaled, rotated, quantized to millimetres and split into colour bands; the source's separate `colonly` objects are excluded. There are no invisible simplified walls across the gaps.

The paired manifest uses nine matching 128 m cells. The original basin spawn is retained. Three geometric clearance routes cover the retained basin circuit, the retained first gorge approach and the new twin-spire gap. These are verification paths, not playable or scored course definitions.

## Provenance and immutable output

The already checked-in source is [loafbrr's Canyon Terrain Asset](https://opengameart.org/content/canyon-terrain-asset), licensed CC0. The exact publisher receipt and upstream README remain under `authoring/fpv-worlds/regions/canyon-badlands/source/`. No external downloads or new core assets are required. Only the named visual rock meshes are selected; plants, terrain tiles, Godot add-ons and preview HDRI are excluded.

- Source model SHA-256: `0b24bb22f0089767990d58401e516ec1853380eda6a33802036a377f8519d623`.
- Parent terrain manifest canonical-JSON SHA-256: `0828de82c5e29fbf61b79dc17b9dea419227faa3ee044cde23fc8b128d15aeb8`.
- Parent terrain manifest file SHA-256: `d5983b35c07f46f66558396c3e22090d7581283a2df395c6f23ff045f3e42c9a`.
- New terrain manifest SHA-256: `2ac0b427f15eb370385320b5d65a8cdd2964814e4f323506fee027948bb01e51`.
- New scenery manifest SHA-256: `a2e116a4be7049808bef431ee9b850508dc072d296f4330ec4629364ebc9f493`.

The tracked `landmark-preparation.json` records every selected source node, placement, dimensions, ground embedding and route. The publisher receipt is preserved as historical source evidence; this increment admits its selected derived meshes only to the authoring companion manifest. It does not promote the original source to a player catalogue.

Final local output: external `fpv-large-worlds-20261014/canyon-landmarks-r7`; independent repeat `canyon-landmarks-r8`. Earlier draft directories remain preserved and are not the accepted source.

## Verification

Run from the repository root, using new external output directories:

```sh
node authoring/fpv-worlds/regions/canyon-badlands/prepare-landmarks.mjs /external/canyon-study-r2 /external/canyon-landmarks-new
node authoring/fpv-worlds/regions/canyon-badlands/verify-landmarks.mjs /external/canyon-study-r2 /external/canyon-landmarks-new
node authoring/fpv-worlds/regions/verify-mixed-window.mjs
```

The verifier checks source hashes, byte-identical terrain, matching manifest identities, canonical GLBs and terrain seams before using the actual paired renderer/collision owner. Results:

- 36 source assets, 1,112,386 bytes; 18 canonical GLBs with zero validator errors or warnings.
- 27 visible rock objects, 81 coloured surfaces, 6,606 additional scenery triangles; the original 18,432 terrain triangles remain unchanged.
- 2,247 actual 0.25 m sphere sweeps along each route's centre and two boundary lanes, plus all 27 individual rock support hits. The declared half-widths are 8 m for the basin and 6 m for the gorge and twin-spire paths.
- All rock base planes conservatively embedded below the enclosing terrain lattice. Serialized terrain heights must agree exactly with the grounding function; every formation must also expose an above-ground collidable triangle.
- Clear basin spawn with actual terrain support, 100 ticks using the shared flight authority, then pause/dispose.
- Nine-cell paired geometry: 673,464 bytes. Disposal returns resident geometry to zero; source files remain unchanged.
- Repeated generation produces the same 41 files byte-for-byte.

The authoring inspection page supports `views=canyon`, the two explicit manifest URLs, `ground=canyon`, and the existing optional shadow lighting. Urban viewpoints remain the default. No promoted runtime module is changed.

Native browser inspection at 1280 × 800 confirmed a readable twin-spire approach and gorge-side landmarks. Review of the final r7 ridge composition confirmed the complete arch silhouette and its visible opening, with four cells, 40 meshes and 306,696 geometry bytes. The initial high-sky camera framing and partly buried crown were corrected before this final receipt. Final r7 Release showed no live scenery or collision; Load restored nine cells, 90 meshes and 673,464 geometry bytes. The authoring shadow profile now selects supported `PCFShadowMap` directly, avoiding the vendor's deprecated-mode fallback warning; the existing two-profile lighting lifecycle check passes.

## Limits and next work

The existing terrain silhouette is still coarse, and the composition outside this arrival/gorge slice remains sparse. Native review particularly identified the gorge's sawtooth rear ridge and repeated horizontal terrain bands as remaining art problems. The rock mesh appearance is stylized and colour-based. This increment does not add terrain tessellation, vegetation, detailed surface textures, mission markers, default map delivery or package qualification. Geometric route clearance is not a claim that a player flew the entire route; the 100-tick flight check only covers the retained spawn and lifecycle. No device FPS or public-release claim is made.
