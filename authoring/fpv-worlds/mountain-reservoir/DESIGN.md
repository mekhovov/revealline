# Reservoir final-world design decision

The accepted r4 pack is a one-course checkpoint. Its two exact proofs and actual
139-check import/Watch run remain attached to that exact pack; they are not final
eight-course evidence.

The approved full-world direction keeps the lake outside the land-side playable
bounds. There is no new water physics, invisible water floor or island-flight
claim. The provisional island concept becomes **Shoreline circuit**: ordered
scenic turns on the land side of the existing yellow rail. Current bounds remain
x −44…6 m, z −34…38 m, y 0…28 m unless an actual collision-reviewed land extension
becomes necessary. All layouts use one identical shared World definition.

Four data-only route candidates use the accepted geometry: western dam crest
(02), exterior service passage (05), rock terrace climb (06) and maintenance roof
landing (08). `build-land-routes.mjs` preserves the exact r4 model, world geometry,
collision and original course. It emits five independent layouts over one World,
with independent Self-level/Acro criteria and explicit null source bindings for
new local route criteria. These are transport-validated candidates, not completed
flights or visual acceptance. Their proposed survey lines require actual swept
clearance; the roof overhang and varying terrace edges are real obstacles.

The remaining engineering increment will add a closed intake-control station and
supported inspection gallery against the accessible western dam face, plus an
external dry spillway at its west abutment descending toward a real shore apron.
It will use existing supported solid/rotated-box collision with the same visible
envelopes. No painted tunnel, unsupported floating platform, underwater inlet
flight or reachable noncolliding terrain is implied. Target: retain the current
one texture/13 material batches and stay below the existing initial authoring
targets of 15,000 imported triangles, 1.2MiB source GLB and 48 collider records.
These targets do not change any production limit.

The final stable challenge IDs are 01–08: Shoreline check-in, Western dam crest,
Intake controls, Dry spillway descent, Exterior service passage, Rock terrace
climb, Shoreline circuit and Maintenance roof landing. Names describe the real
geometry. Geometry changes may require revised waypoints in the four earlier
drafts. Freeze the complete shared scene and all eight bilingual route pairs
before generating the final sixteen ordinary-control demonstrations. Every
record must independently replay against the final exact pack, followed by
actual imported player, editor/reimport and offline qualification.
