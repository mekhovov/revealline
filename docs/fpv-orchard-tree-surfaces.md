# Orchard tree surface increment

The current prototype replaces the six existing authored trunk/crown texture maps in
the five canonical Orchard activities. It keeps the original closed geometry,
UVs, collision solids, actors, objectives, map sizes, material owners and draw
batches. Upright bark grain and opaque leaf clusters add restrained harvest color.
No cards, fruit meshes, gaps or silhouette changes are introduced.

A complete canonical tree-layout and authored-profile guard excludes changed
layouts, custom profiles, Pixel and shared visual collections. The barn, survey
plinth and peripheral Orchard dressing retain their previous materials.

## Qualification in progress

The first source candidate against main `96ef08777` passes 378 manual checks
across 89 scenes and all 30 existing acceptance, texture and workshop checks.
An independent read-only reviewer reran the manual qualifier and found no
actionable issue. This is CPU and scope evidence; actual source and admitted
package browser review are still pending.

The manual qualifier compares complete real-Three geometry/UV bytes and scene
ownership outside the six allowed map images. It covers all 17 shared kits,
Pixel, the five canonical activities, custom-layout/profile rejection, other
world controls, quality transitions, determinism and exactly-once disposal.
The existing renderer remains unchanged relative to the selected main baseline.

Frozen browser preparation uses an explicit renderer entry and transitive local
module closure, verified hashes and only immutable hardlinks. The actual fixture
covers trunk, crown, avenue and plinth views, all three normal quality presets,
Pixel/shared controls, imported/procedural controls and repeated resource loads.

No hardware FPS, new flight demonstration, universal imported-image determinism
or complete-world art acceptance is claimed. New unit coverage remains in D6.
