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
