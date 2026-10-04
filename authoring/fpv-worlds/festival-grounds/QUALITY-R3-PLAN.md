# Festival r3 preparation after the Reservoir checkpoint

The exact paused r2 source from `47f8e36e600205e94883fb5568f37b9ce963e88d`
is preserved on the independent main-based `codex/fpv-festival-quality-r3`
branch. Reservoir's ready data PR #1090 and its frozen artifacts are unchanged.
R2 is a geometry base accepted for further authoring, not final Festival visual
acceptance. It has one orientation course, no ordinary-flight demonstrations,
12,172 imported triangles, 12 material batches, two original maps and 44 static
colliders. The retained 159 checks are historical r2 static checks only.

## Next bounded visual increment

The stage frame, closed market kiosks and clock identify the main areas, but the
wide ground remains sparse and uniformly dressed. Keep the central open lawn,
entry opening, under-stage space and existing 6m service lanes. Improve the
connection between market and gathering space before building the other routes:

- Use the existing west bench to anchor one picnic pocket. A single table can
  use three honest solids: one top and two panel legs, preserving visible open
  space underneath. Proposed envelope X[-36.35,-35.05], Z[13.75,18.25],
  top Y[0.78,0.91]m. It stays outside the service path X[-35,-29]; the narrow
  edge must be inspected in the actual renderer before calling it clear.
- Give both bench areas and kiosk courts irregular, flush worn-ground shapes
  using the existing ground atlas/materials, with controlled low-contrast tint
  variation. No elevation, hidden support, new texture or broad repeating motif.
- Add restrained blue/ochre/chalk event wayfinding on existing closed kiosk
  side/back faces, using original shapes/lettering and the current batches.
  Do not suspend uncolliding fabric across a lane or imply another doorway.

Provisional cost ceiling: 256 additional imported triangles (total <=12,428),
three collider records (47 total), zero additional maps/material batches and no
runtime changes. The source GLB still must satisfy the unchanged 1.5MiB target.
If a marked surface needs depth treatment, handle it explicitly and qualify it;
do not assume render order fixes coplanar faces. No generation or acceptance is
implied by this design note.

## Review and final content gate

Freeze r2 and candidate at identical entry, market, picnic/service-edge, stage
and overview cameras. Root should inspect the newly occupied area close and
wide, plus Low/Balanced/High, Pixel and shared-theme visibility/disposal. The
visual objective is a recognizable community event with readable flight lines,
not denser props for their own sake or a photoreal claim.

After the shared geometry is accepted, finish the eight distinct courses in the
existing design: orientation, three race/route variations, precision landing,
actual follow, actual observe and capstone. Follow/observe must use supported
actor criteria and real ordinary-flight qualification. Finalize one shared
World, then produce all sixteen exact-pack ordinary-control proofs and complete
independent/archive replays. Actual import/editor/Watch and offline verification
remain required for the new world. No default-catalogue, physics, renderer or
production-budget change is planned; unit coverage remains the deferred D6 work.

## r3 candidate checkpoint

The optional `--gathering` authoring path now generates r3. The default source
generator still reproduces the exact r2 GLB SHA256 `4825f1d3…d743d`. Serialized
asset qualification passed 144 checks; collision qualification passed 173.
These are static contracts, not artistic acceptance or ordinary-flight proofs.

The candidate adds 112 imported triangles (12,284 total), three real table
solids (47 total), and 12,196 source bytes (1,122,416 total). It retains the
twelve imported material batches, both encoded maps, all previous vertex/UV/
normal bytes, all 44 previous colliders and the existing orientation route.
Only the existing gravel batch gains normalized RGBA8 vertex color: original
vertices remain opaque white; new courts use at most four percent darkening.
The table's canonical solids draw its body and metal panel legs; an attached
wooden upper finish and partitioned blue/ochre runner provide human scale.
There is no duplicate imported box over its canonical faces.

The tabletop ends at X=-35.05m, leaving 50mm to the painted lane boundary.
That narrow edge is not a promised drone corridor. The six-metre lane center
at X=-32m passes a 720mm-radius sweep, including the usual extra 0.5m margin.
The table/bench-seat gap is 230mm and is not flyable. Between the panel legs,
the opening is 2.98m long with 0.78m headroom; an ordinary 220mm-radius sphere
clears its middle, while each real support blocks contact. The table is a
gathering prop, not a newly required route or landing objective.

Candidate build, source/asset and collision receipts are retained under
`evidence/r3-*.json`. Matched actual-renderer review is still pending. No
additional route, demonstration, offline acceptance or finished-world claim
is made by this checkpoint.
