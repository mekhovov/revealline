# Railway Valley bounded route preparation

This is an original 384 × 384 m authoring study, with nine terrain cells and nine matching scenery cells. The proposed 4 km Railway region remains a design target. Nothing here adds a default Library entry, moving train, scored course, package admission or final-art claim.

The composition introduces a raised trestle above a broad cutting, two freight yards, a station canopy, a maintenance hall with open ends and ridge/field recovery landmarks. Seven corridors cover under-bridge crossing, flight above the deck, a freight lane, the canopy, the hall, the cutting and field recovery. Each corridor has a centre line and two lanes 2 m to either side, checked with a 250 mm sphere.

## Sources and preservation

Eight tank/timber carriages use the pinned [Kenney Train Kit](https://kenney.nl/assets/train-kit), CC0-1.0, with the existing exact source receipt and licence. Their original source files stay unchanged. All 24 placed primitives retain the accepted millimetre positions through translation, complete triangle indices, UVs, normals and the exact 512 × 512 indexed colour palette. A single palette is shared within each prepared scenery window.

The diesel, curved rail and coal carriage remain excluded: their tiny triangles collapse during the current millimetre conversion at this scale. No triangles are silently removed. The track runs and 224 architectural pieces are original generated geometry with matching collision surfaces. The station/hall yard is level under the structures, and portal feet follow their individual terrain locations.

## Reproduce and verify

Run from the repository with the authoring dependencies available, using two new external output directories:

```sh
node authoring/fpv-worlds/regions/railway-valley/prepare-pilot.mjs /external/railway-a
node authoring/fpv-worlds/regions/railway-valley/prepare-pilot.mjs /external/railway-b
node authoring/fpv-worlds/regions/railway-valley/verify-pilot.mjs /external/railway-a
```

Compare all generated files between the directories. The generator refuses an existing output directory. The final reviewed pair was generated as `railway-pilot-r3` and repeated as `railway-pilot-r4`; earlier exploratory outputs remain preserved separately.

Serve the resulting directory and use the existing scenery preview with `manifest=<scenery/region.json>`, `companion=<terrain/region.json>`, `views=railway` and `lighting=urban`. The six camera presets expose the complete composition, trestle, freight yard, hall, canopy and cutting through the actual verified mixed geometry owner.

## Exact receipt

| Evidence                           | Result                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------- |
| Terrain manifest SHA-256           | `74fed25caacb37797094706a0257e562c8ac594781578948d6789ea89120e8fd`     |
| Scenery manifest SHA-256           | `ac591533ee71318cf631e79b8513eb7df61733e86578c8113d879c449f6ebcdb`     |
| Referenced source bytes            | 5,605,907                                                              |
| Canonical GLBs                     | 18; no Khronos validation errors or warnings                           |
| Deterministic regeneration         | All 41 output files byte-identical on a second fresh generation        |
| Preserved licensed primitives      | 24; indices, translated positions, UVs, normals and palette compared   |
| Real collision/support queries     | 1,195 across seven corridors, solid probes and four safe starts        |
| Full paired window geometry        | 1,233,144 B                                                            |
| Shared palette CPU/GPU charge      | 2,446,676 B                                                            |
| Full paired render-resource charge | 3,679,820 B                                                            |
| Disposal                           | Geometry and texture counters return to zero; sources remain unchanged |

The existing transaction budgets are unchanged, including retained and staged resources. Generated content is external authoring output; the application package gains no bundled scenery here.

## Remaining quality work

Native overview and trestle review established a distinct, readable under-bridge route. Final r3 inspection confirmed the grounded station canopy, open maintenance hall and textured freight carriages without console errors. Release removed live scenery/collision; Load restored nine cells, 58 matching meshes/colliders and 1,233,144 geometry bytes. These are bounded desktop authoring observations, not device FPS or player qualification.

The composition is still an architectural blockout: uniform green terrain (including the hall floor), sparse yards and simple bridge structure remain obvious. The next representative pass should add coherent ballast/gravel/concrete, structural bridge detail and useful yard landmarks while preserving or requalifying the measured corridors. Sustained real flights, device performance and delivery/offline qualification remain separate gates under the representative art standard.
