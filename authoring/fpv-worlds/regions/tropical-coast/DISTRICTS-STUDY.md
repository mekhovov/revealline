# Tropical coastal districts: 768 m source study

This is a separate, original six-district composition built from the verified CC0 Tropical intake. It preserves the first 384 m coast and does not change any default Library pin. The nine 256 m cells cover 768 × 768 m (0.589824 km²). Terrain samples remain 33 × 33 per cell: the 8 m sampling interval suits rolling dunes, bays and hills, while piers, huts, trunks and cargo use their detailed solid scenery geometry.

| District         | Two authored landmarks            | Flight purpose                                                                  |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| Harbour          | Covered harbour, harbour headland | Through the covered opening, beneath the deck, and around a rising headland     |
| Lagoon           | Open piers, sandbar               | Approach, turn and brake with an open horizon and offset piers                  |
| Reef             | Rock reef, coastal bluff          | Maintain clearance through a rising coastal traverse                            |
| Palm valley      | Palm valley, dune pass            | Slalom between solid trunks, then follow the low passage between distinct dunes |
| Hillside village | Raised huts, cargo square         | Follow the space between buildings and brake around solid cargo                 |
| Bamboo ridge     | Bamboo grove, ridge overlook      | Follow a corridor through the grove and climb toward a high viewpoint           |

The layout includes twelve authored flight routes and six disarmed starting points. Its longest shoreline route connects all three coastal districts and crosses both internal cell boundaries. Distinct landforms, structure orientations and route purposes supply variety; this is still a sparse source study, not the final rich-world art standard. A 4–8 km archipelago, dense settlements, dynamic water and new gameplay objectives remain separate work.

## Reproduce and verify

Use the unchanged welded RGBA intake created by `prepare-rgba-review.mjs`. Generate into a new output directory:

```sh
node authoring/fpv-worlds/regions/tropical-coast/prepare-coastal.mjs /path/to/rgba-assets /new/districts districts
node authoring/fpv-worlds/regions/tropical-coast/verify-coastal.mjs /new/districts /new/districts/preparation.json
node authoring/fpv-worlds/regions/tropical-coast/verify-commanded-flight.mjs /new/districts /new/districts/preparation.json
```

The generator retains the original coast as its default and byte-reproduces all 39 original generated files. The shared verifier accepts an explicit pinned preparation receipt; it still checks each exact manifest and asset hash. It never derives pass criteria from visual appearance. Flight checks use the production fixed-step session with genuine stick commands in both flight modes, without moving the body between ticks. Negative contact probes exercise the solid trunk, cargo box and roof separately from visual-only leaves and sea.

The complete nine-cell terrain and scenery resources total **3,849,932 bytes**. Conservatively retaining a complete old window and complete candidate window costs **7,699,864 bytes**, below the unchanged 8 MiB ceiling. The exact 38-file delivery closure totals **7,139,502 bytes**, below the unchanged 64 MiB delivery ceiling. No rendering, source or file-count budget is raised.

The sea remains a visual surface at zero altitude above the solid seabed. It has no buoyancy, drowning or water-damage model. Transparent foliage is visual-only; trunks, hut surfaces, piers and cargo remain solid. The source preserves the original intake, licenses and provenance: Ron Kapaun / 3TD Studios, CC0-1.0, [upstream Tropical pack](https://opengameart.org/content/3td-tropical-environment-pack-v20). Terrain, composition and routes are original project work.

Functional and native receipts must be read at their stated scope. A static native view does not establish completed gameplay, sustained device performance, default Library admission or package/offline availability.
