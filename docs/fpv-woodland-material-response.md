# Woodland primary material response

The closed Kenney library uses KHR_materials_unlit on its park materials. Primary
Woodland trees, soil, wood and concrete therefore ignored scene illumination.
For natural Woodland only, remove unlit on eight known library materials and set
explicit metalness/roughness. Six natural surfaces use metalness zero; coated
metal and metal fittings retain bounded values. Unmodified source assets and
licenses are retained; these are runtime material overrides.

The [Khronos glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#material-pbrmetallicroughness)
defaults omitted metallicFactor to one. Explicit dielectric values are necessary
when enabling lighting; the old unlit path did not visibly use that default.
Creator imports are untouched. World/theme/profile Pixel variants retain exact
GLB bytes. Geometry, alpha mode, textures, collisions and course IDs stay unchanged.

## Verification

`evidence/fpv-woodland-material-browser.json` records both arena sizes through
GLTFLoader, including lit MeshStandardMaterial assertions, 16,080 vertices clear
of each flight arena, unchanged sampled draw/triangle counts, five byte-identical
Pixel variants and five byte-identical other environments. Before/after PNG is
alongside it. No additional texture or geometry allocation; PBR shading costs more
than unlit shading and sustained device FPS remains unmeasured.

Reproduce using `node scripts/prepare-fpv-woodland-material-verification.mjs` then
open `docs/evidence/fpv-woodland-material-harness.html` through the local server.
Thirteen existing acceptance/texture checks and ESLint pass. Shared-theme motif
qualification still requires #999 integration on this independent branch.
Development package: 94 files / 15,384,640 bytes, SHA-256
17f3695e9120487bad13b3f35042c5bb4614567ae567cc8ce69f93e50e6b181a.
No public-live claim or new unit coverage.

Review correction: use resolveSimThemeProfile for the natural-material guard.
The five Pixel cases include themeId and nested world.themeProfile overrides.
Both previously bypassed the hand-written guard; actual browser checks now pass.

## Current-main refresh — 3 October 2026

Candidate `9a3cae0886a1712deb09ed97e9ad23246c56d6a2` integrates published main
`2dbbe0a0f26684eae0a2bdb0b7cbda087627457f`, preserving Yard, Stadium, Hangar,
Garage and replacement Woodland tree forms. The implementation remains the
33-line known-material override and theme resolver import in the matching scenery
template/generated runtime. Creator-import handling and the embedded original
library are unchanged.

The new functional receipt proves both Woodland arena GLBs change only the eight
specified materials: geometry, binary texture payload, scene structure and
placements remain exact. All 18 other imported environment/arena GLBs and ten
Pixel cases (five override forms per Woodland arena) are byte-identical. The
original browser receipt also covered five Pixel forms; older PR wording saying
three and the older 15,384,550-byte package figure were stale. The historical
feature document records the later 15,384,640-byte build; neither is current
admission evidence.

All 30 existing acceptance, texture and workshop checks, changed-file lint/format,
syntax and template/runtime equality pass. The bounded current-main browser
fixture has 27 source files / 5,450,028 bytes read directly from this committed
tree. Its source manifest and functional receipt are retained separately from the
historical browser evidence.

The frozen current-main browser review passed on candidate `9a3cae088` against
`2dbbe0a0`: actual GLTFLoader checks preserve 52 placements and 16,080 clear
vertices in both arenas. Sampled calls/triangles remain 24/2,594 for Woodland-08
and 22/2,342 for Beginner-40. Five Pixel override forms retain exact GLB bytes.
The side-by-side views were inspected: corrected planters darken with coherent
surface response and bench wood keeps readable contrast. This is the bounded
fixture's material/clearance evidence, not a production lifecycle, artist or
hardware FPS acceptance. Its receipt and screenshot retain the original candidate
identity.

The all-three source-bound optional admission attempt currently fails with
`Optional package exceeds its byte budget.` The same failure affects #996 after
Garage integration; shared capacity repair is being handled independently.
Keep #1001 draft until normal admission passes; the scoped browser review is complete. Sparse local
full global validation also remains incomplete because unrelated content packs
are absent; current exact-head CI must establish it. No guard or assertion is
weakened, and no new unit, physical-device FPS, human-art or live claim is made.

### Published capacity repair integrated for qualification

Published repair #1011 at `30574b85092e3ddaa973527608a658dfc8adcd5b`
integrates locally as `3f247a5bb80227d7c79c15b765def7d5d20a5bf6`. Its only
runtime delta from the reviewed material candidate removes generated indentation
from `world-reaction-runtime.mjs`; renderer, scenery, material and geometry bytes
remain unchanged. The repair's normalized-AST and 24-recording evidence is in
`fpv-optional-source-budget.md`. That repair also discloses the unrelated
pre-existing hunt assertion: 20/21 checks pass, while the direct canonical-source
test at `fpv-hunt-reactions.test.mjs:169` fails unchanged.

All 30 applicable existing art checks pass again. All three exact-source optional
admissions now pass with two identical builds, committed-input identity and ZIP
member verification. World Studio has 102 files / 15,530,898 runtime bytes; its
95 original inputs total 16,737,060 bytes, leaving 40,156 bytes under the unchanged
16-MiB limit. These are different measurements from the repair-only inventory:
main `2dbbe0a0` had 16,778,114 original-input bytes (898 bytes over); the repair
alone reduces that to 16,735,813 bytes. This material candidate adds 1,247 bytes.

The original failed attempt remains recorded above. The local admission hold is
resolved by the independent repair; publish #1001 only after #1011 lands on main,
then use exact-head protected checks. The frozen browser receipt remains bound to
`9a3cae088`; no broader production or public qualification is inferred.

### Publication after independent repair merge

Repair #1011 merged normally as main `b02ca5a62b8d5ca31550c347adfd275aaf8d8093`.
The material branch integrates that published main at
`843debcdd5ff959d15a3374580791eb434fcabaa`. This merge changes ancestry only:
runtime/build code is identical to admitted `3f247a5bb`, and all 95 admitted
original input hashes match exactly. The new binding receipt records that
comparison; earlier admission and browser receipts keep their explicit candidates.
Subsequent feature commits contain evidence/docs only.

The scoped material review and package hold are resolved. Publish the ready
focused PR through normal exact-head protected CI. The broader combined D1
production-renderer run is separate and still in progress; this PR does not claim
it passed or imply a public deployment.

### Refresh after groves merged

Groves #996 merged as main `e40809f25ea8fe248dea6f8443876d811d21a777`.
The ordinary merge at `06ed832704d68e6111a958e3d0fc1ca34a5c0f63` preserves both
delivery histories. Runtime, physics/model, authoring and build code now match the
already-qualified local combined candidate `e572026ba357f3194bf47e7137a0817cacb1a640`
exactly, including matching scenery template/runtime. All 95 admitted original
input hashes match that candidate. Versus the earlier material-only admission,
the sole input change is `world-assets.mjs`, adding the published 676-byte grove
composition. The new binding receipt records that complete comparison.

The existing combined candidate passed all 30 art checks and all three source-bound
admissions with two builds and committed-input/ZIP verification. World Studio has
102 files / 15,531,574 runtime bytes; 95 original inputs total 16,737,736 bytes,
leaving 39,480 bytes under the unchanged byte guard.

Its production source-browser run passed 14 functional/ownership gates across
90 configurations, three replacement rounds and 60 additional theme controls.
This is retained evidence from `e572026ba`, not a new browser run for this merge.
The admitted-package run is separate. Recorded browser-wall outliers remain
unexplained (maximum RAF interval 32.862 seconds); performance/hardware acceptance
is not implied by the functional pass. Full evidence is preserved separately as
bounded lossless archives for later evidence-only publication. Normal current-head
CI and public deployment verification remain separate.
