# Next Reservoir art checkpoint after the terrace capability

Design only. Published r8/r9/r11, rejected r12, accepted r13 prototype and required
r14 candidate remain immutable. No implementation or new world-production slice
is included in the ready coating runtime branch.

## First inspect and correct tree contact

The current 56 trunks use the exact rendered terrain height at their centre,
minus 0.10m, with a 0.18m bottom radius. That centre sample does not prove that
the complete five-sided foot is embedded on a steep triangle. It is a plausible
contact defect, not proof that every apparent floating tree has the same cause.

Audit each actual trunk foot against the exact serialized terrain triangles.
For a repair, keep all tree centres, crown transforms and upper trunk endpoints
fixed. Clip the pentagonal foot against each overlapping terrain triangle and
evaluate the linear height at all intersection vertices. A flat bottom below
that minimum by a small explicit margin embeds the entire footprint; a centre
or sparse ring sample is insufficient. A modest root flare can be evaluated
within the existing five-sided cylinder topology, with a proposed maximum
0.24m bottom radius. All trees stay outside the playable bounds.

Budget: zero extra triangles, materials, maps, batches or collision records.
Only tree-bark position/normal bytes may change, plus explicit revision metadata.
Keep source/prepared identities, collision arrays, eight routes and all crown
bytes independently compared. Inspect a steep-bank root at close FPV, a whole
cluster at chase distance and the existing overview in all quality tiers before
claiming that rooting is visually solved.

## Then add closed maintenance identity

The hut is a closed canonical box at X[-26,-18], Z[-19,-11], Y[0,4.2]m. The west
service passage and complete roof landing/silhouette must remain exact. Confine
details to the existing south/east closed faces: a restrained inspection ID and
water-maintenance pictogram, a closed vent, door framing and weathered plinth.
No new entrance, apparent window opening, interactive controls or machinery.

Use the existing blue/chalk/amber relationship to the intake landmark. Plan at
most 96 untextured triangles, no additional material/map/batch or collider.
Use a nonoverlapping planar inlay for contrasting marks rather than stacking
coplanar opaque glyph/background faces. If the canonical wall still requires
fixed depth bias, explicitly declare which existing opaque material batches
opt in and inspect their other uses (pad/intake/roof); do not silently extend
the r14 mineral-only scope. Do not spend this allowance before the contact
checkpoint is reviewed.

The r14 source GLB is 1,236,672B, leaving 21,619 whole bytes below the unchanged
1.2MiB target. At the existing 72B-per-triangle untextured layout, the maximum
hut geometry costs 6,912B before small JSON growth. Measure final accessor
layouts and keep a reserve. Broader composition, vegetation quality, commercial
art parity and hardware timing remain independent acceptance questions.

## r15 source checkpoint

Prototype source `b887eda74da9dfe0a688246cafbb218387bc157f` fixes the existing trunk feet only. The independent audit of frozen r14 found exposed underside at 38/56 trees, up to 0.381514m downhill. Clipping the full actual serialized pentagon against the original heightfield lowers 55 flat feet enough to provide an 80mm target embed margin. All horizontal vertices, top endpoints and crown geometry remain exact; no root flare was added.

The separate serialized r15 manual qualifier passes 320 checks, including independent vertex/edge intersection extrema and minimum actual embedding of 79.999mm after Float32 serialization. All other mesh attributes/images/material state, eight courses/collision/routes and resource counts are exact. Source GLB is 1,236,664B (`3215632ac49f9c7142858744140165dd1382b3fda3ea40a7b864688b7305d898`), with 12,288 triangles, 13 materials, three textures, 60 nodes, 48 colliders and 108 collision triangles. The default non-rooted r14 variant still reproduces the exact accepted source bytes.

The immutable fixed-camera fixture uses the full historical b51 admitted 102-file host with no overlays. New source-pack identity is `94415f17be7411cfc1ce79469e28a7d442b31e3dc1b9d146d335e0640c60eb69`, revision r15. The first camera targets tree6 at close FPV, with a cluster chase and unchanged overview available. Actual visual review, final revision flight proofs and content publication remain pending. The capable runtime is separate ready PR #1088; no unfinished tree/hut content is included there. No complete-world art or hardware-performance claim.

### Accepted contact observation

The root reviewer inspected the actual admitted renderer at frozen50016: matched Balanced tree6 Before/After, candidate cluster Balanced, whole composition High and close foot Low. All five observations have no errors and disposal passes with zero registered owners/programs and the context released. The lower trunk now enters the steep terrain with no exposed underside observed. This accepts the bounded contact correction only; sparse bare-rock clustering and broader vegetation/world art remain separate quality limitations. Retained exact receipt and images are in `evidence/r15-*`. No fresh sixteen-flight rerun was performed for this static checkpoint; the final art revision will receive its own proofs.

## r16 closed maintenance candidate

The original imported east windows formed a second high row above the canonical
closed-wall marks. This candidate removes only those two panes and eight frame
boxes (120 triangles). Three opaque panes with flat frames now align to the
canonical three columns at 1.4m height. The panes also exist in Low, which omits
the renderer's canonical flush marks. The front receives an original water-drop
and station 01 stencil, a fully filled striped vent plate, door jambs and a split
plinth. The closed door, roof, west passage and collision remain unchanged.

All new coloured regions partition their planes without overlapping each other.
Their east/front planes are 50mm outside the closed walls, inside the existing
roof envelope and no farther east than the old window trim. They add no physical
support or opening. No extra material is marked for fixed coating: the required
extension remains on the exact existing mineral batch only. Actual grazing,
distance and quality-tier appearance still require review.

The resulting asset adds 92 triangles within the approved 96 limit and removes
120, for a net reduction of 28. The serialized manual audit passes 306 checks:
retained attributes and rooted tree feet are exact; all 92 added triangles are
outward, nondegenerate and confined to the two closed faces; coplanar overlap is
zero and panes, vent and badge are fully filled. All eight courses/colliders and
binding/settings data are identical except the explicit r16 revision. Prepared
ownership, all unaffected geometry and all images/material state remain exact.

Source GLB is 1,234,648B, SHA256
`2ab983dd2262027084cbd23b48d59be866ac790cc15df30ef4a87bec7e3fa843`;
prepared GLB is 1,233,136B,
`6d7d829e337357b61fa212af3691bd8e3088092ce22de9d93011f7e820142bae`.
The candidate has 12,260 triangles, 13 materials, three maps, 60 nodes,
48 colliders and 108 collision triangles. Pack identity is
`50ffbb0e5da7dec94862a8f2ca85cfeb60542d3fe9f86bd3c4e288dfa0a2e554`.
The unmodified r15 variant still reproduces its accepted source SHA exactly.

The manual checker initially assumed tightly packed prepared attributes; the
prepare pipeline interleaves them. Its final decoder reads each accessor's
offset and stride before comparing logical bytes. This was an audit-tool
correction with no candidate asset change. The separate immutable actual-renderer
preview will compare r15 and r16 at identical front/east/grazing/roof cameras,
plus overview and existing shared appearance controls. No visual acceptance,
fresh sixteen-flight qualification, public release or complete-world art claim
is made by this intermediate checkpoint.

### Accepted facade observation

Root actual-renderer review at immutable52089 accepted the bounded r16 facade:
matched front and east Before/After, grazing Balanced, roof approach High,
Pixel Low and shared industrial Balanced. All eight observations have no errors;
disposal passes with zero registered owners/programs and released context. The
duplicate east window row is corrected, the closed maintenance stencil remains
readable and no flicker was observed at the inspected grazing angle. Evidence is
retained in `evidence/r16-*` with exact image hashes. Independent read-only review
of351b58 also found no blocking geometry/ownership defect. This does not claim
complete-world photoreal quality, a hardware benchmark or final revision proofs.
