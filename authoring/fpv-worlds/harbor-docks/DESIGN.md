# Harbor Docks — bounded design audit, 5 October 2026

Initial design recorded before production. Festival is now qualified and published
as Draft #1097 under the human main-merge hold; this independent Harbor branch
has its first scene/one-course candidate. README.md records current checks. No
complete Harbor-scene or ordinary-flight acceptance exists yet; r1's container
and gantry foundations have a bounded actual-renderer acceptance, and r2 addresses
the rejected water/vessel/service-facade gaps. No files in the Festival
release branch were changed for this design. Current runtime reference is merged
main `21826c460e80fa4e7fa47ec8e6ba9f98f75beea4` (the separately admitted `0b54fd0fd`
has all 95 runtime inputs byte-identical).

## Original scene and recognizable composition

A fictional Ukrainian working quay: one unmistakable supported portal/gantry
landmark, grouped closed containers, a stepped maintenance office/service deck,
painted vehicle lanes and a waterside edge. Keep three named readable spaces:
the broad arrival apron, a framed container lane and the high gantry/inspection
zone. The north/east background can show a simple stationary vessel outside the
flight bounds. This is an original layout, not a reconstruction of a real port.

Primary references inspected today:

- [Port of Rotterdam: Maasvlakte 2](https://www.portofrotterdam.com/en/building-port/sustainable-port/making-maasvlakte-2-more-sustainable)
  describes quay cranes and automated guided vehicles as distinct terminal
  systems. Design inference: separate the large handling landmark from the
  ground service route, rather than scatter generic boxes everywhere.
- [Kalmar: straddle carriers](https://www.kalmarglobal.com/equipment/shuttle-carriers/hybrid/)
  distinguishes movement between quayside and landside and ground container
  handling. Design inference: preserve a continuous lane connecting the apron
  and stack groups. Do not claim or implement a working crane, suspension,
  automation system or real equipment model.

References inform organization and scale cues only. No images, logos, competitor
meshes, real operational layouts or third-party textures will be copied. Original
CC0 geometry/maps and existing runtime civilian/fictional actor visuals suffice.

## Proposed physical contract

Provisional playable rectangle: x -44..40m, z -48..46m, y 0..28m; a continuous
solid land-side quay at y=0–2m, with spawn/route raised consistently. Water starts
beyond x=43m at y=0.22m and below the quay, outside all playable bounds. A continuous visible concrete edge/parapet identifies that
boundary. No route crosses water or relies on an invisible water floor; no new
water physics. If this arrangement cannot make the scene feel like a coherent
harbor from FPV and overview, revise the scene before proofs, not the physics.

The gantry uses explicit closed columns and cross-members. Under-beam passage is
real, broad and measurable; a named flat solid supports the precision landing.
Containers are closed, including painted doors. Service-deck support and any
reachable stair/ramp shape must have matching box/rotated-box/trimesh solids.
Decoration stays on those surfaces, above inaccessible spans or outside bounds;
no thin uncolliding bars across a route. Painted recesses cannot imply openings.

Use one shared World/bounds/collision set for all eight layouts. Actors remain
layout-owned. Their paths must lie on real support, including an elevated human
observer subject if a service deck is used. Nominal surveyed paths require the
existing 0.5m extra margin, followed by actual ordinary-control collision proofs.

## Authoring budget before art generation

- Target at most 10,000 imported triangles initially; hard working ceiling 15,000.
- At most 12 imported material batches, two original 256px maps and 48 static
  collider records. Keep at least four collision slots unspent until routes exist.
- Target source/prepared GLB below 1.5MiB, with a measured reserve before final
  detailing. These are content authoring targets, not production-limit changes.
- Spend geometry on supported gantry silhouette, container corrugation/door
  articulation and service-deck depth. Avoid dense decorative clutter. Add no
  scene-wide materials or per-instance textures for signs.
- Reuse existing admitted Theme/Pixel behavior and deterministic actors. No
  runtime file, source-budget, renderer-style, integrator or proof-format changes.
- Prefer authored face partition/inlays over coplanar overlay surfaces. Do not
  repeat Reservoir's depth-fighting repair or require coating merely for trim.
- Material scale: quiet industrial paving/concrete/paint with metre UVs and weak
  local wear. No strongly repeated blotches. Keep blue/ochre landmarks readable
  without washing out the High preset or obscuring gates in Pixel/shared styles.

The current r2 asset uses 7,900 triangles, ten batches, two unchanged maps and 38
colliders, leaving 7,100 triangles and ten collider slots under the hard design
ceilings (six slots before the four-slot route reserve). Its 760,368B prepared
GLB remains below the 1.5MiB target. These asset counts do not establish runtime
cost. Whole-renderer draw/resource
counts must include canonical geometry, objectives and actor presentation; mesh
totals alone do not establish runtime cost or frame rate.

## Eight distinct tasks using existing contracts

1. Quay check-in — orientation through the apron and broad gantry approach.
2. Container lane — ordered low gates around closed stack groups.
3. Gantry climb — a different ordered route with real under-beam/high-side space.
4. Service-deck landing — land on one explicit, axis-aligned named support.
5. Terminal cart escort — civilian vehicle on the continuous land-side lane,
   using genuine `actor-track-v1` range/relative-speed/view/ticks/travel criteria.
6. Deck inspection — observe a walking civilian subject on a supported service
   deck, with genuine continuous tracking; route distinct from the cart.
7. Training-drone bay — explicitly fictional combat using existing `eliminate`
   and deterministic actor/projectile rules, separate from civilian layouts.
8. Harbor circuit — connected capstone across apron, stacks and gantry zones,
   ending on a real pad; not the orientation path with renamed checkpoints.

Names and exact coordinates are provisional. Existing `adventureAuthoringPilot`
already handles actor tracking and eliminate objectives through ordinary inputs;
that is implementation feasibility, not a promise that these paths will qualify.
Both Self-level and Acro require fresh actual completion and independent replay.
No new unit coverage before D6.

## First production milestone after Festival publication

Create an isolated main-based content branch. Generate only the shared initial
scene and one Quay check-in course, then prepare fixed actual-renderer entry,
gantry-underpass, container-close, deck/water-boundary and overview views. Inspect
Low/Balanced/High, Pixel/shared appearance and grazing material boundaries. Do not
expand eight routes before that scene is accepted. Then freeze the final shared
geometry and author all eight with sixteen exact-pack proofs, actual imported
Watch/editor/native/offline and protected publication. A first-course checkpoint
is not a completed Harbor world. Festival artifacts and ready PR stay unchanged.
