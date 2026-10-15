# Railway structural readability study

The bounded 384 × 384 m Railway pilot now has a separate immutable `structure-r1` source revision. Its trestle has side-plane cross braces, top chords, overhead braces and amber post marks. The maintenance hall has exposed roof trusses, side-wall service runs, cabinets, workshop benches and marked door jambs. These give pilots recognizable structural scale and a readable centre route instead of adding arbitrary prop density.

All 66 added pieces are original authored geometry, combined into seven material surfaces and 792 triangles. New solids use the same canonical source triangles for rendering and collision. The central bridge-deck and hall routes remain clear; the six additional probes distinguish an actual brace hit from the open triangle beside it and check hall fixtures and roof clearance. Existing routes, spawn positions, terrain, 49 previous surfaces, the 24 licensed carriage primitives, palette, UVs, normals and source/license receipts are retained exactly.

## Reproduce and verify

Use a new output directory each time. The preparer pins both parent manifests and verifies every parent asset before writing a successor.

```sh
node authoring/fpv-worlds/regions/railway-valley/prepare-structure.mjs /external/railway-pilot-r3 /external/railway-structure-r4
node authoring/fpv-worlds/regions/railway-valley/verify-pilot.mjs /external/railway-structure-r4
node authoring/fpv-worlds/regions/railway-valley/verify-structure.mjs /external/railway-pilot-r3 /external/railway-structure-r4
```

The full route verifier passes 18 GLBs without errors or warnings, all 24 exact licensed primitives, seven clear routes, 1,195 real collision/support queries and four safe spawns. The additional verifier preserves all 18 terrain assets and 49 prior scenery surfaces, checks six new structural hit/clear cases and confirms disposal returns geometry and palette accounting to zero. Independent generation produces 42 identical output files. A local hall-material correction preserves all nine cells’ positions, indices, bindings, UVs, normals and palette; it lightens roof frames and service fixtures without changing global lighting or shadows.

The paired source is 5,675,931 bytes. Full-window geometry is 1,280,664 bytes, an increase of 47,520 bytes. The shared palette remains 2,446,676 bytes; total live geometry/palette accounting is 3,727,340 bytes. Existing source, cell, retained/staged and package ceilings are unchanged. No runtime module or shipping catalogue entry is added.

| Manifest | SHA-256                                                            |
| -------- | ------------------------------------------------------------------ |
| Terrain  | `ed0ea8d9a7dcde8453fd89186c1e8f1982c122e91deee8cc3b33daa6fba5980c` |
| Scenery  | `1cfd2659a7bf1429a47d2652274d437204ffebc3f2ed5bc7a7d48a8959c59f3d` |

The authoring preview exposes **Bridge structure** and **Workshop frames** camera presets; use `views=railway&lighting=urban&ground=railway` with both manifests. The prior [ground presentation](fpv-railway-yard-surface.md) passed native Balanced, Performance and Quality inspection. Quality release/reload returned nine cells, 58 meshes and 1,233,144 geometry bytes for the unchanged pilot fixture, without console errors; this is not an FPS measurement.

Native inspection passes the trestle’s readable bracing and open central route. The first hall material was too dark under the roof; the corrected pale frames and blue services are readable without washing out the walls. Release reports no live scenery/collision; reload restores nine cells, 65 meshes and 1,280,664 geometry bytes. No console errors were observed. This is bounded visual/resource-lifecycle evidence; actual commanded flight is the next separate qualification.

This remains a stylized composition study. Detailed environment dressing, convincing terrain/vegetation composition, sustained flight and device performance, complete player delivery and final representative-art acceptance remain open. It is not a new default playable world, a moving-train feature or a 4 km map.
