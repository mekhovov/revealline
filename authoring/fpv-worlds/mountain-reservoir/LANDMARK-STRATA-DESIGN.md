# Reservoir retaining rock and maintenance identity

Design checkpoint only, on an independent branch from main
`7e76112411f96ae72979cebee0a62ccdd66577d6`. Ready material PR #1081 remains fixed at
`e8f568de1e066a547989f687ef79b39051d042a6`. Its accepted r11 appearance is the
intended visual baseline; integrate that published change normally before a
final later-revision qualification. No scene geometry has changed for this plan.

## First prototype checkpoint

After the design review, published r11 was merged locally onto this independent
branch; ready PR #1081 remains unchanged. The terrace-only r12 prototype appends
238 triangles to the existing mineral batch. Five buried boundary backs are
omitted; no hut allowance has been spent. All original attribute bytes, three
images, thirteen material batches, nodes, eight course arrays and 48 colliders
remain exact apart from the explicit revision.

The source is 1,236,484 bytes, leaving 21,807 whole bytes below the 1.2MiB target;
total triangles are 12,288. The prepared GLB has zero validation errors. A manual
independent GLB/canonical-face comparison passes 559 checks, including every
new triangle's named face, projected bounds and nondegenerate outward winding.
The greatest serialized offset is 1.50164mm, within the six-micrometre allowance
for Float32 quantization of the authored 1.5mm paint separation. The original r11
source still reproduces byte-for-byte when this opt-in finish is disabled.

This prototype was rejected after eight actual renderer views and resource
disposal verification. Close, grazing, landing and chase views preserved the
silhouettes, but the matched overview shows conspicuous brown/grey streaks across
the finish. The 1.5mm imported surface competes with the still-rendered canonical
face at distant depth precision. The rock map also reads as repeated rounded
cell cracks at close range. Neither the source budget nor the 559 face checks
established the missing visual quality. No fresh r12 flight proof, publication
or full-world claim is made.

The immutable r12 fixture remains at port 56105. Its complete observation,
matched overview receipt and before/after images are retained as
`evidence/r12-static-review.json`, `evidence/r12-overview-comparison.json`,
`evidence/r12-overview-before.png` and `evidence/r12-overview-after.png`. The next
candidate must solve surface interference before flight requalification, without
increasing the geometric offset, changing collision planes or using transparent
terrain. Existing external-data contracts cannot suppress a canonical face or
declare polygon offset; any supported rendering prerequisite needs its own
explicit scope and qualification. All earlier revisions remain immutable.

## r13 fixed-coating source prototype

The approved follow-up is isolated on `codex/fpv-reservoir-surface-coatings`.
Its runtime prerequisite is separately checkpointed in `3c7fb4133`: exactly
`SimSurfaceCoating.v1` / `opaque-finish` on a glTF material opts an opaque,
depth-testing/writing material into fixed polygon offset factor/units `-1/-1`.
Additional keys, other versions/kinds, blend/opacity/alpha-mask/transmission or
disabled depth states do not opt in. Imported data cannot choose numeric GL
state. Existing shared material owners are mutated once; Theme variants preserve
the bias and remain separately cached when their depth state differs.

The runtime addition is 1,328 source bytes. It exceeds the projected combined
source headroom and is not admitted; a separately reviewed lossless source
preparation prerequisite is pending. No package cap is raised. Manual CPU
contract/ownership checks pass 49, including no owner allocation by the coating
helper, negative declarations, unchanged unmarked materials, Theme preservation
and exactly-once disposal. Real WebGL appearance remains unaccepted.

The external asset becomes revision r13. Only the existing mineral material opts
in, so the depth-bias scope includes the retained ridge and its boundary skirt as
well as the 238 terrace finish triangles. There is no additional geometry,
material, texture, batch or collider compared with r12. Source bytes rise by 96
to 1,236,580, within the unchanged target. The three image payloads and all old
attribute prefixes remain exact. New vertical faces use the same mineral map at
4m horizontally and 1m vertically, retaining continuous projection across their
four bands; original ridge and top-face UVs stay exact. This is a texture-scale
candidate, not proof that its rock treatment is convincing.

The r13 static fixture declares exactly two source overlays over the historical
complete 102-member admitted player. It is not an admitted candidate package.
Review overview interference first, then close/grazing faces and the ridge/skirt
boundaries in Low/Balanced/High, Pixel and shared industrial appearances. No
fresh flight proof or PR is authorized before that visual review. Hut detail and
vegetation remain deferred.

Actual source review at frozen `024022adfedceb374a7f7e1667182ae5a663990b`
accepted the bounded terrace fix: nine observations, no errors and successful
resource disposal. The overview depth-fighting patches are gone; inspected
Low/Balanced/High, Pixel/shared industrial, ridge grazing and landing/chase views
retain legibility. The complete receipt and overview/grazing/approach PNGs are
retained under `evidence/r13-*`. This does not complete the Reservoir art
standard. It also does not qualify package admission, sixteen new proofs or an
older host's treatment of the new hint. Compatibility must fail closed before
publishing the dependent pack; see `SURFACE-COATING-COMPATIBILITY.md`.

## Concrete problem and ownership

The five playable terrace solids are rendered by the canonical course renderer.
Their prism outlines and flat landing tops are physical gameplay geometry. The
external model owns the distant ridge, r9 boundary closures and decorative paint;
it does not replace those canonical solids. Changing the distant mineral map
alone therefore cannot fix the uniform beige terrace faces.

The maintenance hut is also a canonical closed box. Its current imported details
are two opaque east-facing windows, one blue south-facing closed door, a shallow
roof finish and narrow corrugation. Course 05 uses the real west passage; course
08 lands on the existing roof. Those routes must retain their exact clearance.

## First stage: coherent cut-rock benches

Use the exact existing `rock-west-lower`, `rock-west-middle`, `rock-west-upper`,
`rock-north-shoulder` and `rock-north-terrace` face vertices. Add a thin, opaque
decorative finish over exposed side/top faces, at most 1.5mm outward from the
physical plane. Keep the original collision mesh, all prism silhouettes and
support heights exact. No freestanding stone, apparent crack opening, deep recess
or climbable protrusion is introduced.

Reuse the existing `mineral-ridge` batch, original mineral image and world-metre
projection. Muted grey side faces should visually join the grey ridge; top faces
retain quieter olive weathering. At most four nonuniform, locally broken strata
bands per vertical face use small vertex-color changes with the existing fine
grain. Avoid equally spaced stripes, repeated high-contrast seams and a second
recognizable tiled motif. Do not merely paint dark outlines on the beige blocks.

The five footprints have 32 edges. Four bands per side require at most 256
triangles; their existing top triangulations require 22, giving a strict 278
additional-triangle ceiling. Omit bottom faces and faces buried behind the
neighboring terrace or outlying ridge where the omission is proved by geometry.
Do not remove anything from r9's proven seam closure. The projected duplicate
surface offset is cosmetic paint, not a new collision surface; grazing views
must show no shimmer or shadow artifacts.

Preview this stage before spending the hut allowance. If the result still reads
as generic stacked slabs, retain it as a rejected candidate and revise the visual
design; passing geometry checks does not establish the art benefit.

## Second stage: recognizable closed maintenance hut

Within the same bounded increment, if the first stage is visually useful, reuse
existing enamel/chalk/dark batches for a small original maintenance identifier
panel, closed ventilation grille, door framing and a restrained weathered plinth.
Use simple original geometric marks and an inspection identifier, with a clear
blue/amber accent relationship to the existing intake controls. Do not invent a
doorway behind the existing solid, an interactive panel, new text behavior or
functional machinery.

All detail stays flush on the existing south/east closed faces. Keep the west
passage, every window footprint, roof silhouette and entire roof landing area
unchanged. Allow at most 96 additional untextured triangles. No prop requires a
new collider, no new material/texture/batch is allocated, and the existing imported
batch owners are reused. Vegetation rearrangement/rooting is a separate subsequent
design; it is not bundled into this ready material PR or silently called solved.

## Budget and tradeoffs

The accepted r11 source is 1,210,776 bytes, leaving 47,515 whole bytes below the
unchanged 1.2MiB authoring target. It contains 12,050 triangles, thirteen material
batches, three textures and 48 colliders.

| Allocation               |                   Maximum addition | Encoding basis                                         |
| ------------------------ | ---------------------------------: | ------------------------------------------------------ |
| Cut-rock side/top finish |            278 triangles / 30,024B | Nonindexed position/normal/UV/RGBA8: 108B per triangle |
| Hut identity details     |              96 triangles / 6,912B | Nonindexed position/normal: 72B per triangle           |
| Combined                 |            374 triangles / 36,936B | Existing batches/accessors; no new image payload       |
| Projected remainder      | 10,579B before JSON/padding growth | Measure actual source bytes; do not spend to the cap   |

The projected triangle total is 12,424, below the unchanged 15,000 target. These
are maxima, not an instruction to fill the budget. If actual metadata/padding or
geometry exceeds the allowance, reduce decorative segmentation first. Simplifying
proved invisible decorative faces is a fallback only after exact before/after
coverage review; no source cap increase or collision simplification is permitted.

No new batch means no intended new draw submission or shadow-caster owner, but
additional triangles still cost rendering/shadow work. Record actual draws,
submitted triangles, registered owners and disposal in the same admitted renderer.
Do not predict frame rate from these counts.

## Qualification and review poses

Keep the r11 mineral/grass/gravel images, original vertex prefixes, nodes, source
anchors, bounds, all 48 colliders and all eight route arrays exact. Compare every
new decorative point against its named canonical face and the 1.5mm allowance;
exclude the west service corridor and roof landing envelope explicitly.

Use fixed before/after views: lower west face at 3m, a grazing upper-terrace join,
terrace landing approach, north shoulder, hut south/east at 3m and 12m, the real
west passage, roof landing approach, chase and whole-site overview. Sample
Low/Balanced/High plus Pixel/shared-theme controls for equal route visibility.
Inspect close texture scale, distant composition, seams and paint shadow behavior.

Only an accepted frozen visual candidate receives a distinct pack revision and
sixteen fresh ordinary-control demonstrations with independent full/archive replay.
Use the existing import pipeline and immutable admitted player. Retain every
rejected visual and all earlier pack/proof identities. No new runtime, physics,
water behavior, unit coverage or full-world/FPS/hardware claim is part of this
increment. Festival remains paused until Reservoir meets the representative gate.
