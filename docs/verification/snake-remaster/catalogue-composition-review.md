# Catalogue composition follow-through

## Scope and evidence

All 240 official missions now have explicit cosmetic floor plans. This pass adds plans for the remaining 222; the 18 previously authored and browser-sampled plans are unchanged. Each new plan retains its existing tactical brief in `floorPlan.intent`, literal board coordinates and static component material assignments.

This is catalogue-wide **source/geometry and render-command coverage**, not a claim that 222 boards were individually judged in a browser or by players. A preparation script fitted authored chapter construction rules to the real connected walls, existing docks and switches; the resulting coordinates are saved as editable literal data, with no runtime generation. Its results were checked against all accepted mission geometries and inspected through the chapter audit. Distinct coordinate arrays are not treated as proof of distinct experiences or quality.

The machine-readable `catalogue-composition-review.json` records the exact 222 missions, their tactical intent, chapter pattern, component count, material families and retained landmark anchor. Root browser evidence is reported separately.

## Construction decisions

The former repeated chapter-wide oval/cross/stripe decoration is replaced by quiet marks positioned around each mission's actual structures and static operation objects. Paint never introduces a raised edge, new solid cell, hidden route or new objective. Decorations do not read enemy positions, spawn points, patrol routes, jammer stations or random streams.

| World       | New mission plans | Connected structures reviewed | Material construction                                                                                                             |
| ----------- | ----------------: | ----------------------------: | --------------------------------------------------------------------------------------------------------------------------------- |
| Orchard     |                26 |                            65 | Glasshouse focal buildings, planter windbreaks, irrigation support; growing beds and delivery aprons                              |
| Harbor      |                32 |                            91 | Pump focal equipment, narrow dock foundations, floodgate supports; paired quays and sparse wrapping-edge inlays                   |
| Freight     |                44 |                           135 | Dispatch focus, loading platforms for narrow structures, container supports; dispatch approach brackets, loading strips and rails |
| Foundry     |                38 |                           109 | Pressure or boiler focal machinery, coolant supports; interrupted service courts and assembly aprons                              |
| Basalt      |                38 |                           105 | Excavation or reclaimed machine focus, terrace edges and secondary foundations; stepped survey paving and perimeter marks         |
| Observatory |                44 |                            95 | Receiver focus, antenna supports, shelter blocks; calibration corners, sparse listening-post markings and paired test courts      |

205 of these 222 missions now combine at least two appropriate structure families. The others legitimately have only one connected structure, no structure, or one applicable material role. No extra obstacle was introduced merely to add variety.

The material role is attached to the actual original component cells. If erosion splits a component, each surviving cell retains its selected material. Runtime selection does not assign colors/families using a mission hash, modulo index or current enemy location. External edges and landmark clipping still come from current accepted terrain; the original groups never cause removed cells to be painted.

All four production looks consume these same plans and material roles. Existing Toybox construction, Ruins weathering, Night Arcade illumination and Lively FPV native materials remain shared. Creator-owned walls continue through their existing authoritative provider path. Game Theme/Retro retain their established render paths.

## Implementation and resource limits

- `classic-compositions.mjs`: 222 literal floor plans and 600 component groups; the prior 18 remain intact.
- `classic-structure-art.mjs`: selects the authored material for the current surviving wall cell before applying the existing modular kit.
- `classic-worlds.mjs`: cosmetic revision `snake-worlds-v5` invalidates old terrain entries; simulation recipes and grades remain untouched.
- No new atlas, canvas, retained surface, engine or live cache was introduced. Source descriptor data grows, but the retained-surface budget stays at 16 MiB.
- Root owns bounded chapter/mission navigation in the comparison gallery. The gallery must not mount all 960 board/look canvases simultaneously.

## Verification

18 targeted tests passed across composition quality, remaster art and worlds. The catalogue test now renders every floor plan in all four looks and verifies actual path commands, quiet patch opacity, bounded coordinates, preserved level data and board clipping. It checks each authored component cell belongs to a real wall exactly once, every family is valid for the world, and materials survive changed component bounds after erosion.

Seven additional world-cache tests passed, including the 240-mission LRU walk and the aggregate retained-surface check below 16 MiB (25 tests total). Existing tests continue to cover creator images, holes and removed walls, shared selector rendering, material/backdrop bounds, and the previous connected boiler/pump fixes. ESLint passed for changed source and tests. No gameplay build or proof was produced by this visual task.

## Remaining subjective review

The work closes missing cosmetic descriptors and repeated generic chapter-pattern coverage. It does not establish that all 240 compositions are equally memorable, or that they meet every player's aesthetic preference. Root's sampled browser checks should identify any remaining excessively busy structure or faint mobile mark; those findings can be corrected without changing gameplay. Physical-device performance and player enjoyment remain separate evidence categories.

### Sampled browser correction: Alpine Toybox

Root browser inspection at approximately 320px board width found Alpine Toybox wall rectangles too close to the pale blue-grey floor. The solids now use darker indigo enamel with the existing warm timber edges. Native receiver vents, shelter windows and antenna masts distinguish their construction roles without adding a surface or changing their footprint. A regression checks at least 2:1 luminance contrast between the enamel fill and nominal floor tint, including distinct role geometry; this is an internal terrain-readability guard, not a claim of text accessibility conformance. All 12 composition/art tests passed after this small correction, along with ESLint. Previous 25-test coverage remains recorded above.
