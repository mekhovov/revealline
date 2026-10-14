# Free-world Library cohort

Sixteen optional, portable CC0 practice maps. The construction site preserves Majadroid’s assembled scene; the other fifteen are new layouts assembled from Kenney kits, not fifteen pre-existing complete worlds. Each has one discovery course with Self-level and Acro, collision, a safe spawn, EN/UK instructions, editable project and two replay-verified flight records. They are introductory practice layouts, not full campaigns or a claim to cover every free asset on the Internet.

## Included maps

| World | Source | Download size |
|---|---|---|
| Castle Courtyard | [castle-kit](https://kenney.nl/assets/castle-kit) | 0.15 MiB |
| City Plaza | [city-kit-commercial](https://kenney.nl/assets/city-kit-commercial) | 1.23 MiB |
| House Construction Site | [construction](https://opengameart.org/content/3d-house-construction-site-lowpoly-cc0) | 2.26 MiB |
| Frontier Camp | [survival-kit](https://kenney.nl/assets/survival-kit) | 0.16 MiB |
| Industrial Service Yard | [city-kit-industrial](https://kenney.nl/assets/city-kit-industrial) | 1.01 MiB |
| Orbital Workshop | [space-station-kit](https://kenney.nl/assets/space-station-kit) | 0.15 MiB |
| Pine Clearing | [nature-kit](https://kenney.nl/assets/nature-kit) | 0.13 MiB |
| Platform Garden | [platformer-kit](https://kenney.nl/assets/platformer-kit) | 0.15 MiB |
| Race Paddock | [racing-kit](https://kenney.nl/assets/racing-kit) | 0.38 MiB |
| Roadworks Practice Park | [city-kit-roads](https://kenney.nl/assets/city-kit-roads) | 0.06 MiB |
| Rock Grotto | [modular-cave-kit](https://kenney.nl/assets/modular-cave-kit) | 1.37 MiB |
| Ruined Halls | [modular-dungeon-kit](https://kenney.nl/assets/modular-dungeon-kit) | 1.67 MiB |
| Dry-dock Shipyard | [pirate-kit](https://kenney.nl/assets/pirate-kit) | 0.58 MiB |
| Skate Plaza | [mini-skate](https://kenney.nl/assets/mini-skate) | 0.20 MiB |
| Village Green | [city-kit-suburban](https://kenney.nl/assets/city-kit-suburban) | 0.59 MiB |
| Woodland Camp | [mini-forest](https://kenney.nl/assets/mini-forest) | 0.30 MiB |

## Play or edit

In a compatible SIM, open Library → Browse optional worlds → install the chosen map, then Fly and select its named campaign. Downloads are optional and do not enlarge the core offline package. For this source candidate before publication, import the `.rlpack` from `distribution/r1/<world>/` through Library. Import its `.zip` into Workshop to edit. Proof archives are portable recordings, separate from the pack.

## Preparation and verification

Use the pinned dependencies in `authoring/fpv-worlds/package-lock.json`. Run from the repository root:

```sh
python3 authoring/fpv-worlds/free-worlds/download.py /tmp/fpv-free-world-sources /tmp/fpv-free-world-archives
```

Export `HouseConstructionSite.blend` from the construction source with official Blender 4.5.14 LTS. Run the included Python exporter with factory settings and disabled auto-execution, passing an absolute output path `/tmp/fpv-free-world-sources/construction/construction.glb`. Keep the original Blender scene unchanged. The palette is embedded in the original scene.

```sh
node authoring/fpv-worlds/free-worlds/build.mjs /tmp/fpv-free-world-sources authoring/fpv-worlds/free-worlds/source/downloads.json
node authoring/fpv-worlds/free-worlds/qualify.mjs
```

Source receipts retain archive URLs, SHA-256 and original license text. Each prepared map records geometry/collision counts, Khronos validation and exact GLB/pack identity. The builder verifies pack and editable-project round trips and exact model bytes. Collision uses placed geometry; dense geometry is simplified offline within the existing bounds. Small construction props use conservative boxes. Individual small gaps and every off-route manoeuvre are not comprehensively qualified.

Scene `extras.fpvCollisionVisuals` lists canonical collision surfaces already represented by imported artwork. The renderer suppresses only those duplicate placeholder meshes after successful load and restores them on unload. `extras.fpvGroundVisual: true` additionally declares an authored floor and scenery, suppressing the procedural ground/backdrop after load. Overview/editor inspection omits fog for these maps; FPV/chase retain the exact course fog. Physics remains unchanged. Older scenes without this declaration retain their appearance. Older players will still import these packs but may draw duplicate collision surfaces; the new Library cohort is offered only by the updated player.

`distribution/r1/flights.json` records 32 completed, collision-free flights and independently matching replays. This is functional content verification, not real-device FPS, exhaustive route exploration or novice-player acceptance. Additional unit coverage stays in D6.

## Not yet prepared

The remaining seven resources from the guide are Poly Haven collections, not ready-to-import GLBs. The six Blender scene archives are approximately 1.1–3.4 GB each; Smugglers Cove currently offers a roughly 13.2 GB Unreal project. They need bounded texture/mesh preparation, supported-format export, collision and authored spawn/routes before admission. They are not listed as playable downloads in this cohort.

| Collection | Required next work |
|---|---|
| [Hidden Alley](https://polyhaven.com/collections/hidden_alley) | Export and optimize the Blender scene; author collision and course; verify import/replay. |
| [Pine Forest](https://polyhaven.com/collections/pine_forest) | Export and optimize the Blender scene; author collision and course; verify import/replay. |
| [The Shed](https://polyhaven.com/collections/the_shed) | Export and optimize the Blender scene; author collision and course; verify import/replay. |
| [Verdant Trail](https://polyhaven.com/collections/verdant_trail) | Export and optimize the Blender scene; author collision and course; verify import/replay. |
| [Namaqualand](https://polyhaven.com/collections/namaqualand) | Export and optimize the Blender scene; author collision and course; verify import/replay. |
| [Moon](https://polyhaven.com/collections/moon) | Export and optimize the Blender scene; author collision and course; verify import/replay. |
| [Smugglers Cove](https://polyhaven.com/collections/smugglers_cove) | Assemble supported individual assets; Unreal-project conversion is not supported. |

The existing 3 GiB stable local free-space floor remains in force for full package builds. This cohort does not raise core, world, archive, texture or geometry limits. The Library metadata cap is explicitly bounded to 32 entries / 32 KiB so the existing three maps and these sixteen fit. Public availability requires protected merge and deployment verification.
