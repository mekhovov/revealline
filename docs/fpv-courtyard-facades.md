# Courtyard closed house facades

This D2 increment adds readable civilian facade detail to the two houses inside
the Ukrainian Courtyard. Their previous plain dark window marks gain frames,
mullions and sills. Closed paneled timber doors, plinth and roof-edge bands, and
an original blue/cream geometric entrance border give the buildings scale. It
complements the exterior street-front terraces from #961.

## Scope and ownership

Only `house-west` (8 × 8 × 20 m) and `house-east` (8 × 7 × 26 m) in the
`courtyard` environment receive artwork. The geometry helper rejects renamed,
resized, rotated, typed and unsupported obstacles. Every added vertex lies on one of the
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

The final manual qualifier uses current main
`e40809f25ea8fe248dea6f8443876d811d21a777` as baseline, including the source-budget
repair and Woodland composition. It passes 950 checks across
171 scene cases: all 11 associated catalogue courses, three bounds, three
presets, authored/Pixel/all 17 shared collections, exact existing geometry, UVs,
transforms and material pixels, outward wall coplanarity, canonical ID/dimension
scope, wall ray distances, overlapping paint order and exactly-once disposal.
Other 13 worlds retain their baseline scene/material snapshots. All 19 installed
Courtyard recordings replay successfully through 42,265 ticks, retaining exact
final World state identities. All 54 retained optional-FPV JavaScript/WebAssembly
inputs remain exact except the edited visual module.

Corrected runtime SHA-256:
`ccd21097afc0ba1b6a630e0c35c1b881fd0c36ef5f4d98f21f6b6e081aefa71a`.
CPU evidence binds this hash and its qualifier hash; the recorded Git head is the
checkout head before evidence capture. The final manual receipt refresh retains
the same runtime hash and all previous counts, while rebinding the baseline asset
module to the reviewed incoming Woodland composition. Full `npm run validate`, scoped lint/format and the existing 30 workshop, texture
and acceptance-workflow checks pass under Node 22.22.2. No new unit coverage is
added before D6.

The frozen source fixture is
`dist/fpv-courtyard-facades-verification-source-v4-guarded`. Its before side uses
main `2dbbe0a0f26684eae0a2bdb0b7cbda087627457f`; the reaction whitespace repair is
outside the 31-module rendering closure. It uses the actual flight renderer and
procedural fallback scenery. The actual player observation below covers imported
GLB scenery; the static harness does not load it. In addition to image, resource
and geometry checks, it rays
every vertex of the actual old window meshes to require coverage by the new
front layer.

The earlier v2 source fixture passed mechanical WebGL checks but was rejected in
visual review because its windows did not align with the existing marks. Those
results do not qualify this corrected appearance. Both corrected entrance views passed visual review. Final guarded source WebGL
qualification passes 261 checks / 163 image pairs, including exact Pixel pixels,
coverage of every actual old window mark, unchanged base geometry, three stable
resource cycles, zero registered resources after disposal and no unexpected
context loss. Source receipt SHA-256:
`9a0d1b6d7cf6bb93f1753a854fc4f324e56e6530928f9f8c773ccdce363bbe5f`.

## Frozen package

The first source admission failed at the existing byte limit and wrote no
candidate directory. Separately reviewed repair #1011 removes indentation from
the generated reaction projection. Its normalized syntax tree, 24 voice-recording
bytes and generator check remain exact; no guard or asset was removed. The
existing unrelated audio warning-priority assertion remains recorded in the
repair's evidence; no broad all-green regression is claimed.

Repair #1011 merged to main as `b02ca5a62`; the art branch integrated it normally.
The corrected, clean source candidate is
`c452dd215d62f5e0a5b87584f407a6c7a24cdd6b`, tree
`ddb5b5ecd82b44d85703133a243db832e61370a7`. All 31 rendering modules match the
final guarded source fixture. The packaged harness changes only the provenance
label to say “Runtime SHA-256”; every render/qualification statement is unchanged.
The source fixture's historical `candidate: "."` is bound unambiguously to this
runtime by its full per-module hash inventory.

Node 22.22.2 admits all three optional packages with two identical builds,
committed-source checks and ZIP-member verification:

| Package         | Admitted files | Admitted bytes |
| --------------- | -------------: | -------------: |
| Civilian Flight |             48 |        679,266 |
| Civilian FPV    |             69 |      4,384,679 |
| World Studio    |            102 |     15,536,580 |

World Studio's original inputs total 16,742,742 bytes, leaving 34,474 bytes under
the unchanged 16 MiB guard. All 15 artifact checksums were independently reread.
Distribution ZIP SHA-256:
`00e62f023317fceb6f4c223fd25b4477a040e4ecacc3c27905c79ea38e37a4d4`.
The separate player contains 94 files / 15,378,809 bytes. All 31 packaged-renderer
modules match both the admitted ZIP and player; compared with source, only the
intentionally generated locale catalogue differs. Candidate/playtest/packaged
fixture directories retain suffix `c452dd215` under `dist/`.

The actual packaged browser passes all 261 checks / 163 image pairs. Its complete
check and image-sample arrays equal the accepted source arrays exactly. Packaged
receipt SHA-256: `0eb9d1723b14aeb986bbff22cb8b7ca50f6257a7912455f7ada1179c4054e4fc`.
The actual Courtyard welcome player rendered both finished facades, armed,
advanced flight ticks and paused. The retained screenshot captures its rendered
0.4-second flight. These observations qualify this bounded art increment; they
are not a finished-world or physical-device performance claim.

## Current-main integration

Main's Woodland composition #996 merged at
`e40809f25ea8fe248dea6f8443876d811d21a777` and was integrated normally as
`6b81d2120ddb1f5b5e8ec86adb94686b9acf65cb`, tree
`c0e69a635165eb0e95c06c7fb680d5a0792ffc23`. The scoped integration audit passes
280 checks. The facade, renderer, collision/replay inputs and 54 retained runtime
modules are exact to the accepted candidate; only the scenery composition module
changes. All 22 Courtyard authored/Pixel GLBs and 178 other non-Woodland GLBs are
byte-identical; the 22 Woodland variants alone change. No repeated full browser
matrix is claimed for this merge.

The clean integrated candidate passes fresh Node 22 source-bound admission for
all three packages, two identical builds, committed inputs and ZIP members. The
Flight and FPV packages retain 48 / 679,266 and 69 / 4,384,679 admitted files/bytes;
World Studio has 102 / 15,537,256. Its 95 original inputs total 16,743,418 bytes,
leaving 33,798 bytes under the unchanged 16 MiB guard. All 15 checksums were
independently reread.
Its World Studio distribution ZIP SHA-256 is
`294a938f8f422e51864f04e192047d5cb5cafa6df2cb059d4e38040b550f50e0`.
The integrated player has 94 files / 15,379,485 bytes; all 31 rendering modules
match its admitted ZIP, and 30 remain exact to the accepted player. The sole
changed module produces the exact Courtyard GLBs proven above. Candidate and
player directory suffixes are `6b81d2120`.

`publicEligible` and `releaseQualified` remain false in local receipts. Protected
source CI, merge and public deployment remain separate publication boundaries.

Human, physical-device performance and final artist acceptance remain open.
