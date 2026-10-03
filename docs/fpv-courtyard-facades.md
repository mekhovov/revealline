# Courtyard closed house facades

This D2 increment adds readable civilian facade detail to the two houses inside
the Ukrainian Courtyard. Their previous plain dark window marks gain frames,
mullions and sills. Closed paneled timber doors, plinth and roof-edge bands, and
an original blue/cream geometric entrance border give the buildings scale. It
complements the exterior street-front terraces from #961.

## Scope and ownership

Only `house-west` (8 × 8 × 20 m) and `house-east` (8 × 7 × 26 m) in the
`courtyard` environment receive artwork. The geometry helper rejects renamed,
resized, typed and unsupported obstacles. Every added vertex lies on one of the
original vertical box faces. Existing obstacle meshes, roof silhouettes, garden
wall, well, school obstacles, routes, actors, cameras and physics remain exact.
The closed opaque panes and doors do not represent flyable openings.

The artwork aligns with the renderer's existing window grid: five columns on the
long walls, three on the short ends and three rows. New panes completely cover the
old marks; the closed entrance covers the lower central mark. Its small geometric
border sits below the middle-row sill. Existing plaster grain remains visible.
All original marks use offset layer 2. New layers are strictly in front: plinth
and roof 3, door 4, accent 5, pane 6 and trim 7. No physical face moves.

The two houses share six batches: 5,712 non-indexed vertices / 1,904 triangles in
every quality preset. They are opaque and receive shadows but add no shadow
casters. World-space UVs use the existing Themes material roles. Materials and
shared maps remain owned by the world and are released once on course disposal.
Pixel retains its previous appearance and receives no facade batches.
Authored finishes use untextured materials; shared Themes reuse the material kit.
No external asset, image, network request, licence or package file is added.

Authored scene ownership rises by six geometries and 12 materials with no new
textures; Industrial Workshop rises by six geometries, nine materials and one
existing timber-role map. Pixel counts are exact. These are CPU ownership counts,
not GPU/frame-time measurements or a finished-world claim.

## Source qualification

The manual qualifier uses published source-budget repair head
`30574b85092e3ddaa973527608a658dfc8adcd5b` as baseline. It passes 949 checks across
171 scene cases: all 11 associated catalogue courses, three bounds, three
presets, authored/Pixel/all 17 shared collections, exact existing geometry, UVs,
transforms and material pixels, outward wall coplanarity, canonical ID/dimension
scope, wall ray distances, overlapping paint order and exactly-once disposal.
Other 13 worlds retain their baseline scene/material snapshots. All 19 installed
Courtyard recordings replay successfully through 42,265 ticks, retaining exact
final World state identities. All 54 retained optional-FPV JavaScript/WebAssembly
inputs remain exact except the edited visual module.

Corrected runtime SHA-256:
`451e42a3714c1d012e9edcdb81a640b854081902b2801c14e3f89ab9f8cda7a9`.
CPU evidence binds this hash and its qualifier hash; the recorded Git head is the
checkout head before evidence capture. No new unit coverage is added before D6.

The frozen source fixture is
`dist/fpv-courtyard-facades-verification-source-v3-covered`. Its before side uses
main `2dbbe0a0f26684eae0a2bdb0b7cbda087627457f`; the reaction whitespace repair is
outside the 31-module rendering closure. It uses the actual flight renderer and
imported GLB scenery. In addition to image, resource and geometry checks, it rays
every vertex of the actual old window meshes to require coverage by the new
front layer.

The earlier v2 source fixture passed mechanical WebGL checks but was rejected in
visual review because its windows did not align with the existing marks. Those
results do not qualify this corrected appearance. The v3 visual preview and
source/package browser runs remain pending at this checkpoint.

## Package prerequisite

The first source admission failed at the existing byte limit and wrote no
candidate directory. Separately reviewed repair #1011 removes indentation from
the generated reaction projection. Its normalized syntax tree, 24 voice-recording
bytes and generator check remain exact; no guard or asset was removed. The
existing unrelated audio warning-priority assertion remains recorded in the
repair's evidence; no broad all-green regression is claimed.

That repair merged normally into the art branch as `5456cb08d`. The superseded
v2 art at that commit passed all three admissions, two identical builds and
committed-source/ZIP checks. Its receipts retain the exact source identity but
do not qualify the corrected v3 artwork. A fresh frozen admission and packaged
player will follow accepted visual preview. No Courtyard PR is published before
the repair lands and the corrected source/package/player is qualified.

Human, physical-device performance and final artist acceptance remain open.
