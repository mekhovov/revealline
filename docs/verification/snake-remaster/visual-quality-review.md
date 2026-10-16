# Authored composition quality follow-through

## Findings and changes

The retained `worlds-desktop.png` baseline shows recognizably different Toybox floors, but several worlds still use repeated small machinery tiles. Its open board has a generic square seal and broad chapter stripes unrelated to the mission. Source inspection confirms the opening chapter repeats one oval motif, and adjacent early missions in other worlds repeat their chapter motif and structure family.

This pass changes 18 official cosmetic compositions: the six-mission opening chapter, its following two boards, and two adjacent representatives in each remaining world. It does not describe the other 222 missions as individually visually remastered by this pass.

- Literal floor plans replace generic chapter stripes and oversized repeated motifs on these 18 boards. Aprons fit the existing structures; interrupted service markings give open space an authored arrangement without suggesting a wall.
- Six painted station insignia replace the generic square seal: botanical stem, valve, freight chevrons, tide, receiver and survey marker.
- Foundry boiler/pressure structures now join into one assembly with continuous sheet metal, outer ribs and one inspection port. A rectangle no longer resembles a pile of tiny boilers.
- Parent browser inspection found the Harbor pump island still looked like repeated tiny machinery. Pump islands now have joined two-tone casings, exterior rails, one continuous intake row and the existing single focal pump; thin structures receive one native fitting. Exact wall footprints remain unchanged.
- Selected adjacent missions use different existing structure families. No new wall, collision footprint, actor, reward, recipe revision or random stream is introduced.
- All four looks retain the same plans. Toybox uses wider painted lines, Ruins broken paint, Night Arcade restrained inlays, and Lively FPV thin service markings. Original creator wall images remain authoritative.
- Environment revision advances to `snake-worlds-v4`, invalidating previous cosmetic terrain cache entries. No retained surface or new atlas was added; the existing 16 MiB budget is unchanged.

## Reviewed arrangements

“Reviewed” below means source/geometry inspection and render-command regression unless subsequent browser evidence is recorded. It does not mean a player judged the board beautiful or fun.

| World       | Mission pair / opening sequence       | Concrete distinction and route/solid check                                                                                                  |
| ----------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Orchard     | Open Loop → Twin Islands              | Empty nursery flight lawn versus diagonal glasshouse aprons. Open Loop remains obstacle-free; both island footprints stay exactly occupied. |
| Orchard     | First Baffle → Offset Blocks          | Irrigation service elbow versus three staggered seed beds. Flat markings lie beneath actual wall silhouettes.                               |
| Orchard     | Room to Follow → First Circuit        | Parallel growing aisles versus a distribution hub around three existing structures. No implied extra passage or wall.                       |
| Orchard     | Open Elbow → U-turn Yard              | Canal turning court versus reservoir return. The raised elbow/U walls remain authoritative.                                                 |
| Harbor      | Long Island → Split Islands           | One pump causeway versus two floodgate aprons. Second mission uses the floodgate family instead of another pump.                            |
| Freight     | Forked Chase → Parallel Paths         | Dispatch splitting yard versus parallel loading strips. Dispatch cabin and platform silhouettes differ, with unchanged solid cells.         |
| Foundry     | Opposite Arrivals → Crossing Schedule | Opposed coolant bays versus pressure transfer court. One uses coolant structures, the other joined pressure machinery.                      |
| Observatory | Oval Intercept → Split Yard           | Receiver calibration apron versus two shelter test ranges. Central blocked structures remain intact, with receiver and shelter materials.   |
| Basalt      | Long Opening → Moving Fork            | Excavated survey spine versus reclaimed terrace fork. Excavation and reclaimed machine families make the focal structure different.         |

All plan coordinates are explicit and bounded by the real 24×18 boards. They are not chosen by mission-name hashing. A distinct mission name is not counted as a distinct composition: tests compare actual path/patch data.

## Reproducible comparison

Open `game/test/manual/snake-world-gallery.html?review=authored`. It renders 18 actual mission definitions × four looks (72 boards), with the production `drawClassicBoard` path and Auto chapter scenery. Existing controls provide 320px-equivalent width, grayscale, hidden titles and collision outlines. The normal gallery remains available at the URL without the query.

The authored comparison deliberately uses each mission's own board, including Observatory missions. It does not substitute the default gallery's active-jammer recording for every Observatory card.

## Verification

- 17 targeted tests passed across composition quality, remaster art and world suites.
- New checks cover 18 unique geometric plans, two representatives per world, bounded coordinates, actual draw paths for all four looks, quiet patch opacity, unchanged level data, one foundry inspection port per joined structure, and one Harbor intake row/fitting rather than repeated pumps.
- Existing checks retain creator images, removed-wall holes, shared selector previews and bounded material/backdrop caches.
- Root browser inspection checked the opening and all world pairs at the gallery's 320px-equivalent board size, selected Toybox material variants, and Night Arcade grayscale/collision views. It caught and confirmed the Harbor fix. Screenshots: `quality-authored-mobile-scale.png` and `quality-authored-collision-grayscale.png`. These are desktop gallery views with small board canvases, not a physical phone test or a complete review of all 72 variants.
- Screenshot and render-command checks do not establish enjoyment, physical-device frame rate, or whole-catalogue visual uniqueness. A later chapter batch should apply the same explicit composition review to remaining repeated chapter motifs.
