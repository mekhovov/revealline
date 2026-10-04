# Reservoir material scale — proposed next increment

This branch starts from main `f3764070e`; the qualified seam repair is isolated
in PR #1077 at `ab3a3585d`. Its accepted r9 source must reach normal main history
before this later revision is published. No r8 or r9 pack, proof or fixture is
overwritten, and Festival remains paused.

Implementation was subsequently authorized within this scope. The published r9
head was merged locally into this independent branch; PR #1077 remains unchanged.
The first static candidate is revision r10, not a publication candidate. It has
12,050 triangles, 13 materials, three textures and 48 unchanged colliders. The
two new original 128px images total 45,004 bytes; source GLB is 1,216,772 bytes
(`dd622e212522c50805f0efbe577fb911fa732603ccb324436df4640f2fdb2353`),
prepared GLB is 1,215,260 bytes
(`47df9d90932315bea83b117b49d4fc97aa6322cab1cd75230a066904ecfc2b9d`).
The pinned prepare pipeline has zero validation errors. Manual asset comparison
passes 148 checks; the original r8/r9 generation also remains exact in 315 checks.
The first standalone gravel prototype was rejected during author inspection
because it resembled fitted paving; the scene candidate uses separated aggregate
and dusty gaps instead. Visual acceptance remains pending.

Fresh r10 qualification at frozen source `60b5161950563d76ef4bf87c97ed6f6d3f716632`
passes 575 checks: all sixteen ordinary flights finish with full health and zero
contacts, then replay independently both directly and after archive import.
All retained r9 physical fields, recorded controls, sampled paths and final state
identities match exactly. Only the course identity inside each proof changes
for revision r10. The new 908,574-byte archive has SHA-256
`231479765bfd49f1663c5caeb98de695f3d4f7ed28f318e74729b91489fddd78`.
Full qualification and comparison receipts are retained as
`evidence/r10-qualification.json` and `evidence/r10-r9-flight-comparison.json`.
This does not establish actual resource disposal, visual quality, native browser
import, offline behavior or hardware performance for r10.

## Problem observed in frozen r8/r9

The subsequent native r9 smoke used the unchanged complete 102-file admitted
248b player: the visible Library chooser imported the exact `28a50…` pack as
eight challenges, recording import reported 16/16 verified, and the native
catalogue exposed the eight courses with Watch controls. Shoreline check-in
rendered, deliberately armed, became Flight active and paused. The compact
root-observed receipt and screenshot are retained in
`evidence/r9-native-smoke.json` and `evidence/r9-native-active.png`. This is an
import/flight smoke, with no new offline or sixteen-Watch claim. It is recorded
on this follow-up branch without resetting the ready r9 PR's checks.

The decorative rock ridge, reachable grass overlay and gravel paths all sample
the same original 256px mineral image at the same four-metre repeat. Geometry
and colors differ, but the repeated mineral veining gives three different
surfaces the same material scale. The broad lawn therefore looks like a flat
painted sheet, and close paths have little readable aggregate. The existing
source GLB spends 66,240 bytes on that single image.

This pass should improve the ground seen during actual flight, not merely an
overview. It does not solve the box-like canonical terraces, civic facade detail,
tree silhouettes, purposeful maintenance props or drone presentation; those need
their own concrete design and review before the representative-world gate closes.

## Bounded candidate

Keep the r9 rock image, terrain positions/normals/index, seam closure, all 48
colliders, eight route pairs and bounds exact. Give the existing `shore-meadow`
and `warm-gravel` material batches distinct original small albedo images and
world-metre UV scales. Initial targets: a muted 1–2m grass/soil tile with fine
irregular blades and sparse dry patches, and a 0.5–1m gravel tile with visibly
smaller, irregular aggregate. Avoid high-contrast regular bands, giant grain,
plastic sheen or features that appear to be flight openings/obstacles.

Retain all 13 material batches and every geometry/triangle count; no extra draw
batch, prop, shadow caster or production renderer/style change. The proposed
allocation increase is two 128px images/textures, so imported texture count
would rise from one to three. That is an explicit authoring-budget proposal,
not an already accepted allocation or a production-limit increase. Keep added
encoded images below 48KiB and the complete source GLB below the existing 1.2MiB
target. R9 has 86,823 bytes of source headroom. If the visual result needs more,
revise the design rather than silently raising the target.

The two new textures belong only to this external GLB. Existing Authored/Pixel
and shared-theme handling stays in the admitted renderer. Verify actual filtering,
visibility and lifecycle there rather than assuming a texture-count bound proves
correct appearance or disposal.

## Acceptance and qualification

Freeze identical cameras before and after: low FPV at the shore pad/path edge,
close inspection of gravel and grass from about 3m, a 10–20m approach including
the maintenance hut, chase showing the real racer and ground clearance, and a
whole-site overview. Near-ground detail should read without looking noisy at
distance; seams, silhouettes and route landmarks must remain intact.

Use the same representative poses in Low/Balanced/High, plus Pixel/shared-theme
controls. Qualify unchanged collision, course definitions and original GLB
geometry; permit only named material/image/UV changes. Record imported and total
renderer textures, draw calls, submitted triangles and disposal behavior. No
universal pixel parity is expected on the two intentionally changed surfaces,
but unchanged role data must be byte-identical. No FPS or hardware claim follows
from static views.

After visual acceptance, publish a distinct exact pack with all sixteen fresh
dependency-bound demonstrations and independent replays, plus a bounded native
import/Watch check. Reuse admitted immutable players and keep any rejected
visuals. Extra unit coverage remains in D6. None of these steps establishes
finished Reservoir art by itself.
