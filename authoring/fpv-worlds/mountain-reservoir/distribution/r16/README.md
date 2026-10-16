# Mountain Reservoir r16 — retaining finish, rooted trees and maintenance hut

This revision brings the previously separate terrace, contact and closed-facade
checkpoints into one exact eight-course pack. The terrain finish follows the
existing rock faces; fixed opaque coating prevents the rejected r12 depth
patches. All 56 existing tree feet enter the actual terrain, with crown geometry
and horizontal placement unchanged. Three closed hut panes replace the duplicate
window row; an original water-service 01 stencil, closed vent, jambs and plinth
give the maintenance landmark a clearer identity.

- [Playable pack](mountain-reservoir.r16.rlpack) — import through Library.
- [Editable project](mountain-reservoir.r16.zip) — import through the creator.
- [Sixteen demonstrations](mountain-reservoir.r16.proofs.json) — import after
  this exact pack; one per challenge in Self-level and Acro.

Use GitHub's raw download for these files. Pages does not serve the repository's
authoring directory. Retain older recordings with their exact original pack;
they are not silently rebound to r16.

**Player capability:** this pack requires `REVEALLINE_surface_coating` version 1,
kind `opaque-finish`, introduced by the separate coating runtime change
[#1088](https://github.com/mekhovov/revealline/pull/1088). Use a Worlds player
that supports that required glTF extension. An older or stale cached player must
reject the asset instead of rendering the unsupported overlapping rock finish.
An r8/r9/r11 download remains available for those older players. This requirement
adds no physics, user-supplied depth values, material owners or runtime script to
the content pack.

All eight bilingual routes, collision envelopes, roof landing and water boundary
are unchanged apart from the explicit revision. Water remains scenery outside
the playable land-side bounds. The source has 12,260 triangles, 13 materials,
three original maps, 60 nodes, 48 colliders and 108 collision triangles. New hut
paint adds 92 triangles while removing 120 redundant window-box triangles.

Qualification currently includes 306 serialized hut/ownership/closed-region
checks, the retained 320 tree-contact checks and 575 fresh ordinary-flight/replay
checks for 16 exact-pack demonstrations. Every flight completes with full health,
zero contacts and the intended physical landing. Inputs, terminal physical
results and sampled paths match r14. Separate accepted actual-renderer receipts
cover required coating, tree contact and eight matched facade/tier/theme views,
including owned-resource disposal. Final r16 import/editor/complete Watch
verification passes 304 actual-browser checks with all 16 exact endpoints and
no recorded errors. The full receipt identifies the exact admitted 364 player,
pack and proof archive; its runtime relationship to merged main is separately
audited in 120 checks.

The browser import/complete Watch matrix uses controlled RAF timestamps,
advancing 200ms per delivered frame at the public 1× replay rate. It preserves the
real performance clock, focus/visibility and production pause guards; it never
assigns flight state, ticks or completion. Each full replay must finish through
the real UI and match the exact final simulation and renderer-observed identity.
This is not native-clock playback of all 16 proofs, endurance or FPS evidence.
The separate native-clock mode uses genuine RAF and performance time in the
same fixture wrapper, retaining the draw observer and private storage namespace.
It verified Ready → Arm → active at 47.1s with zero throttle → keyboard P pause
and the Continue menu. The click-based Pause attempt failed because the fixture
viewport was outside the operator's visible area. This is a zero-throttle launch
smoke, not an unmodified standalone-entry run or a completed native flight.

This is a bounded original art improvement. It is not photoreal/commercial art
parity, hardware/FPS acceptance or a claim that every vegetation/composition
quality question is closed. R12's rejected depth artifacts and r10's rejected
grass motif remain in the retained authoring history. Earlier r8 true-offline
qualification is historical and is not presented as a newly repeated r16 run.

Bundled content remains 196 challenges / 14 worlds; installing Reservoir yields
204 authored challenges / 15 installed worlds. No default-catalogue, source-budget,
precache, runtime or physics limit changes are part of this data release.

[Exact hashes and evidence](manifest.json),
[scope and accepted views](../../ROOTING-MAINTENANCE-DESIGN.md),
[required capability contract](../../SURFACE-COATING-COMPATIBILITY.md),
[eight route descriptions](../r8/README.md),
[original CC0 art license](../../source/LICENSE.md).
