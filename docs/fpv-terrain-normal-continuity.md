# Regional terrain lighting continuity

14 October 2026. This visual-only authoring follow-up uses the complete validated
resident height grid to calculate normals. A point shared by adjacent cells now
gets the same slope normal from both sides, including four-cell corners and negative
cell coordinates. Height values, rendered positions/indices, canonical source hashes,
Rapier colliders and support/sweep queries stay unchanged.

Calculation happens once during preparation, never in the input or frame loop. The
same normal buffer size remains in the existing geometry budget. The temporary
height lookup is bounded by the existing maximum 25 cells and released after
preparation. Outer edges without a resident neighbour use one-sided differences;
this does not claim continuity into unloaded cells or eliminate silhouette faceting.

Verification: 132 identical seam samples, 4,356 finite upward unit normals, source
and ordering invariance, isolated-border checks; five exact-source surface/collision
parity scenarios and 11 existing terrain checks. Codex browser prepared the Canyon
Gorge view without errors. Coarse terrain slopes, scenery and art acceptance remain
open. Regional player/catalogue admission is unchanged.
