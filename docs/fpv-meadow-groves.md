# Meadow exterior composition

C2 gives the meadow a recognizable clearing instead of a uniformly spaced tree
ring. Four unequal groves use the same 32 existing trees, with irregular gaps and
staggered depth. Their locations follow the actual flight bounds, so larger school
arenas do not push every tree out onto a distant circular horizon.

Only the paired trunk/crown X/Z positions change. Seeded heights, silhouettes,
materials, textures, resource ownership, fog, lighting and quality settings stay
the same. Every crown remains at least ten metres beyond a flight-bound face;
the scenery cannot close an authored route. No collider, objective, actor,
camera, demonstration, package dependency or appearance preference is added.

This is a composition pass, not the final realistic foliage art pass. Three.js
documents the cost of adding scene objects and draw calls in its
[optimization guide](https://threejs.org/manual/pages/optimize-lots-of-objects.html).
Keeping the current assets and count bounds this increment while improving its
silhouette. More detailed foliage and instancing remain part of reviewed art and
performance work, with actual device measurements required before any FPS claim.

## Shared Themes integration

Draft PR #955 owns shared material roles, appearance selectors and recording pins.
Merge these placement changes with its tree material bindings; do not replace
either visual module wholesale. There is no second palette or theme system here.

## Verification

The maintained before/after fixture uses pinned main
`07f227f5042364a73cbbc66cc783e40c93baea9a` and a bounded import closure. It covers
the four actual field arena sizes, three graphics presets and FPV/chase/overview
views, plus non-field scene comparisons, resource lifetime and boundary checks.
Source WebGL verification passes 147 checks and 45 image pairs. All 13 other
environments compare exactly. All 178 demonstrations replay successfully over
327,795 ticks. The field cases keep a measured minimum 10.10000003 m clearance
from full tree bounds, including an offset rectangular placement probe.

Registered resources remain equal, but grouping trees changes how many are in
view. Peak draw calls across the inspected views change 141→157 (Performance),
182→205 (Balanced), and 266→289 (Quality); the largest per-view increase is 23.
Peak submitted triangles in Quality change 8,728→9,170. Three reload cycles
plateau, and registered allocations reach zero on disposal. These are bounded
resource observations, not an FPS or latency benchmark. See the adjacent browser
and replay receipts. Additional unit coverage remains in H/R7; physical handheld,
novice and artist acceptance remain separate.

After touch PR #959 merged, the unpublished C2 commits were rebased onto
`1d0b359f7`, preserving the earlier candidate in a recovery ref. Integrated
candidate `1975948b32aa4c3b016cb58b987a15b1f98e5661` passes the same 147 WebGL
checks and 178 replays, all three package admissions, committed-input/ZIP checks
and two reproducible builds. Source file counts remain 35/68/100 under the
inherited 64/72/104 limits; bytes remain within 8/8/16 MiB. Final receipts use the
`fpv-meadow-groves-*main959*` names. Public deployment is a separate gate.

Published as [PR #960](https://github.com/mekhovov/revealline/pull/960) directly
against main. Both normal local playtest URLs include the merged touch changes
and this scenery pass; public availability still requires protected publication
and actual deployment/launch verification.
