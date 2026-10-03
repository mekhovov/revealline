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
of each flight arena, unchanged sampled draw/triangle counts, three byte-identical
Pixel variants and five byte-identical other environments. Before/after PNG is
alongside it. No additional texture or geometry allocation; PBR shading costs more
than unlit shading and sustained device FPS remains unmeasured.

Reproduce using `node scripts/prepare-fpv-woodland-material-verification.mjs` then
open `docs/evidence/fpv-woodland-material-harness.html` through the local server.
Thirteen existing acceptance/texture checks and ESLint pass. Shared-theme motif
qualification still requires #999 integration on this independent branch.
Development package: 94 files / 15,384,550 bytes, SHA-256
9d319f83f54b0c995e2f590e10a13fefad4925606ff83420f0eeac168015db0c.
No public-live claim or new unit coverage.
